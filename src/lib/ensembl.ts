import { LRUCache } from 'lru-cache'
import shRNADb from './shRNA.json';

interface ShRNARecord {
  'Gene ID': string;
  'Gene Symbol': string;
  'Transcript RefSeq ID': string;
  'Final shRNA Seq for CRISPR-All Syntax': string;
}

const shRNAData: ShRNARecord[] = shRNADb as ShRNARecord[];

const ENSEMBL = 'https://rest.ensembl.org';
const GRCH37 = 'https://grch37.rest.ensembl.org';

type Species = 'homo_sapiens';

interface LookupGene {
  id: string;
  display_name: string;
  canonical_transcript?: string;
  transcripts?: Array<{ 
    id: string; 
    is_canonical?: number; 
    length?: number;
    biotype?: string;
    ccds?: string[];
    is_mane_select?: number;
    appris?: string;
  }>;
}

// In-memory LRU cache
const geneCache = new LRUCache<string, LookupGene>({
  max: 500, // Store up to 500 items
  ttl: 1000 * 60 * 60 * 24, // 24 hour TTL
});

const cdnaCache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24,
});

// Local storage cache helpers
const CACHE_PREFIX = 'ensembl_cache:';
const CACHE_VERSION = 'v1';

function getLocalStorageKey(type: 'gene' | 'cdna', key: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${type}:${key}`;
}

function getFromLocalStorage<T>(type: 'gene' | 'cdna', key: string): T | null {
  const stored = localStorage.getItem(getLocalStorageKey(type, key));
  if (!stored) return null;
  try {
    const { value, timestamp } = JSON.parse(stored);
    // Check if cache is older than 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getLocalStorageKey(type, key));
      return null;
    }
    return value as T;
  } catch {
    return null;
  }
}

function setInLocalStorage(type: 'gene' | 'cdna', key: string, value: any): void {
  try {
    localStorage.setItem(
      getLocalStorageKey(type, key),
      JSON.stringify({
        value,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    // Handle quota exceeded or other storage errors
    console.warn('Failed to store in localStorage:', e);
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (r.status === 429 || r.status === 503) {
    const reset = Number(r.headers.get('x-ratelimit-reset') || 1);
    const remaining = Number(r.headers.get('x-ratelimit-remaining') || 0);
    
    // If we're rate limited, wait for the reset time plus a small buffer
    if (remaining === 0) {
      await new Promise(res => setTimeout(res, (reset + 0.1) * 1000));
      return fetchJSON<T>(url, init);
    }
  }

  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export async function searchEnsembl(query: string): Promise<Array<{ symbol: string; description: string; sequence: string }>> {
  if (query.length < 2) return []
  
  try {
    // Use HGNC API for gene search (same as module-selector.tsx)
    const JSON_HDR = { headers: { "Accept": "application/json" } }
    const searchURL = `https://rest.genenames.org/search/${encodeURIComponent(query)}`
    const sRes = await fetch(searchURL, JSON_HDR).then(r => r.json())
    const hits = (sRes.response?.docs || []).slice(0, 5) // Limit to 5 results
    
    const results = hits.map(({ symbol, name }: { symbol: string; name: string }) => ({
      symbol,
      description: name || `Human gene ${symbol}`,
      sequence: ""
    }))
    
    return results
  } catch (error) {
    console.error('Ensembl search error:', error)
    return []
  }
}

export async function resolveGene(
  symbol: string,
  species: Species = 'homo_sapiens',
  opts?: { base?: string; forceRefresh?: boolean }
): Promise<LookupGene> {
  const cacheKey = `${species}:${symbol}`;
  
  // Check caches unless force refresh is requested
  if (!opts?.forceRefresh) {
    const cached = geneCache.get(cacheKey) || getFromLocalStorage<LookupGene>('gene', cacheKey);
    if (cached) return cached;
  }

  const base = opts?.base ?? ENSEMBL;
  const url = `${base}/lookup/symbol/${species}/${encodeURIComponent(symbol)}?expand=1`;
  
  const gene = await fetchJSON<LookupGene>(url);
  
  // Cache the result
  geneCache.set(cacheKey, gene);
  setInLocalStorage('gene', cacheKey, gene);
  
  return gene;
}

export function pickTranscript(g: LookupGene): string | undefined {
  // 1. Use canonical_transcript if present
  if (g.canonical_transcript) {
    // Remove version number if present (e.g., ENST00000269305.9 -> ENST00000269305)
    return g.canonical_transcript.split('.')[0];
  }

  const transcripts = g.transcripts || [];
  
  // 2. Find transcript with is_canonical = 1
  const canonicalTranscript = transcripts.find(tr => tr.is_canonical === 1);
  if (canonicalTranscript) return canonicalTranscript.id.split('.')[0];

  // 3. Find MANE Select transcript
  const maneSelect = transcripts.find(tr => tr.is_mane_select === 1);
  if (maneSelect) return maneSelect.id.split('.')[0];

  // 4. Find APPRIS principal transcript
  const apprisPrincipal = transcripts.find(tr => 
    tr.appris?.startsWith('principal') || tr.appris === 'P1' || tr.appris === 'P2'
  );
  if (apprisPrincipal) return apprisPrincipal.id.split('.')[0];

  // 5. Fall back to longest protein-coding transcript
  const proteinCoding = transcripts
    .filter(tr => tr.biotype === 'protein_coding')
    .sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  if (proteinCoding) return proteinCoding.id.split('.')[0];

  // 6. Last resort: longest transcript of any type
  const longest = transcripts.sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  return longest?.id.split('.')[0];
}

export async function fetchCdna(
  transcriptId: string,
  opts?: { base?: string; forceRefresh?: boolean }
): Promise<string> {
  // Check caches unless force refresh is requested
  if (!opts?.forceRefresh) {
    const cached = cdnaCache.get(transcriptId) || getFromLocalStorage<string>('cdna', transcriptId);
    if (cached) return cached;
  }

  const base = opts?.base ?? ENSEMBL;
  const url = `${base}/sequence/id/${transcriptId}?type=cdna`;
  
  const r = await fetch(url, { headers: { Accept: 'text/plain' } });
  if (!r.ok) throw new Error(`Sequence fetch failed: ${r.status}`);
  
  const sequence = await r.text();
  
  // Cache the result
  cdnaCache.set(transcriptId, sequence);
  setInLocalStorage('cdna', transcriptId, sequence);
  
  return sequence;
}

// Batch sequence fetching
export async function fetchCdnaBatch(
  transcriptIds: string[],
  opts?: { base?: string }
): Promise<Record<string, string>> {
  const base = opts?.base ?? ENSEMBL;
  const url = `${base}/sequence/id`;

  const uncachedIds = transcriptIds.filter(id => !cdnaCache.has(id) && !getFromLocalStorage('cdna', id));
  
  if (uncachedIds.length === 0) {
    // All sequences are cached
    return Object.fromEntries(
      transcriptIds.map(id => [id, cdnaCache.get(id) || getFromLocalStorage('cdna', id)])
    );
  }

  const response = await fetchJSON<Array<{ id: string; seq: string }>>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ids: uncachedIds,
      type: 'cdna',
    }),
  });

  // Cache new results
  response.forEach(({ id, seq }) => {
    cdnaCache.set(id, seq);
    setInLocalStorage('cdna', id, seq);
  });

  // Combine cached and new results
  return Object.fromEntries(
    transcriptIds.map(id => {
      const cached = cdnaCache.get(id) || getFromLocalStorage('cdna', id);
      const fresh = response.find(r => r.id === id)?.seq;
      return [id, cached || fresh || ''];
    })
  );
}

export interface EnsemblModule extends Module {
  symbol: string;
  hgncId?: string;
  ensemblGeneId?: string;
  canonicalTranscriptId?: string;
  sequence?: string;
  sequenceSource?: 'ensembl_grch38' | 'ensembl_grch37' | 'shRNA.json';
  ensemblRelease?: string;
}

export async function enrichModuleWithSequence(
  module: Module,
  opts?: { base?: string; forceRefresh?: boolean }
): Promise<Module> {
  try {
    console.log(`Enriching module: ${module.name} (type: ${module.type})`);

    if (module.type === 'knockdown') {
      const shRNARecord = shRNAData.find(record => record['Gene Symbol'] === module.name);
      if (shRNARecord && shRNARecord['Final shRNA Seq for CRISPR-All Syntax']) {
        const sequence = shRNARecord['Final shRNA Seq for CRISPR-All Syntax'];
        console.log(`Found shRNA sequence for ${module.name}`);
        return {
          ...module,
          sequence,
          sequenceSource: 'shRNA.json',
        };
      } else {
        console.error(`shRNA sequence not found for knockdown module: ${module.name}`);
        throw new Error(`shRNA sequence not found for ${module.name}`);
      }
    }
    
    // Fallback to Ensembl for non-knockdown modules
    console.log(`Fetching sequence from Ensembl for ${module.name}.`);
    const gene = await resolveGene(module.name, 'homo_sapiens', opts);
    console.log(`Resolved gene:`, gene);
    
    const transcriptId = pickTranscript(gene);
    console.log(`Selected transcript ID: ${transcriptId}`);
    
    if (!transcriptId) {
      throw new Error(`No suitable transcript found for ${module.name}`);
    }

    const sequence = await fetchCdna(transcriptId, opts);
    console.log(`Fetched sequence length: ${sequence.length}`);
    
    return {
      ...module,
      sequence,
    };
  } catch (error) {
    console.error(`Failed to enrich module ${module.name}:`, error);
    // Re-throw the error to be handled by the calling component
    throw error;
  }
} 