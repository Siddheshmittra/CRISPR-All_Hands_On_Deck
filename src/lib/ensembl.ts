import { LRUCache } from 'lru-cache'
import shRNADb from './shRNA.json';
import rawGrnaDb from './gRNA.json';
import { Module } from './types';
import { safeLocalStorage } from './uuid';

interface ShRNARecord {
  'Symbol': string;
  'Final shRNA Seq for\nCRISPR-All Syntax': string;
}

interface GrnaRecord {
  geneSymbol: string;
  gRNASequence: string;
}

const shRNAData: ShRNARecord[] = shRNADb as ShRNARecord[];
const gRNAData: GrnaRecord[] = (rawGrnaDb as any[]).map(r => ({
  geneSymbol: (r['Official Gene \nName'] as string).trim(),
  gRNASequence: (r['Final gRNA Seq for\nCRISPR-All Syntax'] as string).trim(),
}));

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
  const stored = safeLocalStorage.getItem(getLocalStorageKey(type, key));
  if (!stored) return null;
  try {
    const { value, timestamp } = JSON.parse(stored);
    // Check if cache is older than 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      safeLocalStorage.removeItem(getLocalStorageKey(type, key));
      return null;
    }
    return value as T;
  } catch {
    return null;
  }
}

function setInLocalStorage(type: 'gene' | 'cdna', key: string, value: any): void {
  safeLocalStorage.setItem(
    getLocalStorageKey(type, key),
    JSON.stringify({
      value,
      timestamp: Date.now(),
    })
  );
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
  if (query.length < 2) return [];
  
  const searchHGNC = async (): Promise<Array<{ symbol: string; description: string; sequence: string }>> => {
    try {
      const response = await fetch(`https://rest.genenames.org/search/${encodeURIComponent(query)}`, {
        headers: { "Accept": "application/json" }
      });
      
      if (!response.ok) throw new Error(`HGNC API responded with status ${response.status}`);
      
      const data = await response.json();
      const hits = data.response?.docs || [];
      
      return hits.slice(0, 5).map((hit: any) => ({
        symbol: hit.symbol,
        description: hit.name || `Human gene ${hit.symbol}`,
        sequence: ""
      }));
    } catch (error) {
      console.warn('HGNC search failed, falling back to direct Ensembl search:', error);
      throw error; // This will trigger the fallback to Ensembl search
    }
  };
  
  const searchDirectEnsembl = async (): Promise<Array<{ symbol: string; description: string; sequence: string }>> => {
    try {
      const response = await fetch(
        `https://rest.ensembl.org/lookup/symbol/homo_sapiens/${encodeURIComponent(query)}?expand=1`,
        { headers: { "Content-Type": "application/json" } }
      );
      
      if (!response.ok) {
        // If not found, try search endpoint
        const searchResponse = await fetch(
          `https://rest.ensembl.org/lookup/symbol/homo_sapiens/${encodeURIComponent(query)}*?expand=1`,
          { headers: { "Content-Type": "application/json" } }
        );
        
        if (!searchResponse.ok) return [];
        
        const data = await searchResponse.json();
        return Object.values(data).slice(0, 5).map((gene: any) => ({
          symbol: gene.display_name,
          description: gene.description || `Human gene ${gene.display_name}`,
          sequence: ""
        }));
      }
      
      const gene = await response.json();
      return [{
        symbol: gene.display_name,
        description: gene.description || `Human gene ${gene.display_name}`,
        sequence: ""
      }];
    } catch (error) {
      console.error('Direct Ensembl search failed:', error);
      return [];
    }
  };
  
  // First try HGNC, fall back to direct Ensembl search if it fails
  try {
    const results = await searchHGNC();
    if (results.length > 0) return results;
    return await searchDirectEnsembl();
  } catch (error) {
    return await searchDirectEnsembl();
  }
}

export async function resolveGene(
  symbol: string,
  species: Species = 'homo_sapiens',
  opts?: { base?: string; forceRefresh?: boolean }
): Promise<LookupGene> {
  const cacheKey = `${species}:${symbol}`;
  console.log(`[resolveGene] Attempting to resolve gene with key: ${cacheKey}`);
  
  // Check caches unless force refresh is requested
  if (!opts?.forceRefresh) {
    const cached = geneCache.get(cacheKey) || getFromLocalStorage<LookupGene>('gene', cacheKey);
    if (cached) {
      console.log(`[resolveGene] Cache hit for key: ${cacheKey}`);
      return cached;
    }
  }
  console.log(`[resolveGene] Cache miss for key: ${cacheKey}. Fetching from Ensembl.`);

  const base = opts?.base ?? ENSEMBL;
  // Retry strategy: try provided symbol, then known alias fixups, then HGNC search-derived symbols
  const candidates = [symbol];
  if (symbol.toUpperCase() === 'P53') candidates.push('TP53');
  let lastError: any = null;
  for (const sym of candidates) {
    const url = `${base}/lookup/symbol/${species}/${encodeURIComponent(sym)}?expand=1`;
    console.log(`[resolveGene] Fetching URL: ${url}`);
    try {
      const gene = await fetchJSON<LookupGene>(url);
      console.log(`[resolveGene] Successfully fetched data for key: ${species}:${sym}`, gene);
      geneCache.set(cacheKey, gene);
      setInLocalStorage('gene', cacheKey, gene);
      return gene;
    } catch (e) {
      lastError = e;
      console.warn(`[resolveGene] Failed for symbol ${sym}:`, e);
    }
  }
  // As a final fallback, query HGNC for synonyms/aliases and retry with top hits
  try {
    const hgncHits = await searchEnsembl(symbol);
    for (const hit of hgncHits) {
      const sym = hit.symbol;
      const url = `${base}/lookup/symbol/${species}/${encodeURIComponent(sym)}?expand=1`;
      console.log(`[resolveGene] Retrying with HGNC-derived symbol: ${sym} → ${url}`);
      try {
        const gene = await fetchJSON<LookupGene>(url);
        geneCache.set(cacheKey, gene);
        setInLocalStorage('gene', cacheKey, gene);
        return gene;
      } catch (e) {
        lastError = e;
      }
    }
  } catch (e) {
    lastError = e;
  }
  throw lastError || new Error(`Failed to resolve gene symbol ${symbol}`);
}

export function pickTranscript(g: LookupGene): string | undefined {
  console.log(`[pickTranscript] Picking transcript from gene data:`, g);
  // 1. Use canonical_transcript if present
  if (g.canonical_transcript) {
    console.log(`[pickTranscript] Found canonical_transcript property: ${g.canonical_transcript}`);
    // Remove version number if present (e.g., ENST00000269305.9 -> ENST00000269305)
    return g.canonical_transcript.split('.')[0];
  }

  const transcripts = g.transcripts || [];
  console.log(`[pickTranscript] Found ${transcripts.length} transcripts to evaluate.`);
  
  // 2. Find transcript with is_canonical = 1
  const canonicalTranscript = transcripts.find(tr => tr.is_canonical === 1);
  if (canonicalTranscript) {
    console.log(`[pickTranscript] Found canonical transcript (is_canonical=1):`, canonicalTranscript);
    return canonicalTranscript.id.split('.')[0];
  }

  // 3. Find MANE Select transcript
  const maneSelect = transcripts.find(tr => tr.is_mane_select === 1);
  if (maneSelect) {
    console.log(`[pickTranscript] Found MANE Select transcript:`, maneSelect);
    return maneSelect.id.split('.')[0];
  }

  // 4. Find APPRIS principal transcript
  const apprisPrincipal = transcripts.find(tr => 
    tr.appris?.startsWith('principal') || tr.appris === 'P1' || tr.appris === 'P2'
  );
  if (apprisPrincipal) {
    console.log(`[pickTranscript] Found APPRIS principal transcript:`, apprisPrincipal);
    return apprisPrincipal.id.split('.')[0];
  }

  // 5. Fall back to longest protein-coding transcript
  const proteinCoding = transcripts
    .filter(tr => tr.biotype === 'protein_coding')
    .sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  if (proteinCoding) {
    console.log(`[pickTranscript] Falling back to longest protein-coding transcript:`, proteinCoding);
    return proteinCoding.id.split('.')[0];
  }

  // 6. Last resort: longest transcript of any type
  const longest = transcripts.sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  if (longest) {
    console.log(`[pickTranscript] Falling back to longest overall transcript:`, longest);
    return longest.id.split('.')[0];
  }

  console.error(`[pickTranscript] No suitable transcript found.`);
  return undefined;
}

export async function fetchCdna(
  transcriptId: string,
  opts?: { base?: string; forceRefresh?: boolean }
): Promise<string> {
  console.log(`[fetchCdna] Attempting to fetch cDNA for transcript ID: ${transcriptId}`);
  // Check caches unless force refresh is requested
  if (!opts?.forceRefresh) {
    const cached = cdnaCache.get(transcriptId) || getFromLocalStorage<string>('cdna', transcriptId);
    if (cached) {
      console.log(`[fetchCdna] Cache hit for transcript: ${transcriptId}`);
      return cached;
    }
  }
  console.log(`[fetchCdna] Cache miss for transcript: ${transcriptId}. Fetching from Ensembl.`);

  const base = opts?.base ?? ENSEMBL;
  const url = `${base}/sequence/id/${transcriptId}?type=cdna`;
  console.log(`[fetchCdna] Fetching URL: ${url}`);
  
  const r = await fetch(url, { headers: { Accept: 'text/plain' } });
  if (!r.ok) {
    console.error(`[fetchCdna] Sequence fetch failed. Status: ${r.status}, Text: ${r.statusText}`);
    throw new Error(`Sequence fetch failed: ${r.status}`);
  }
  
  const sequence = await r.text();
  console.log(`[fetchCdna] Successfully fetched sequence for transcript: ${transcriptId}. Length: ${sequence?.length}`);
  
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
  sequenceSource?: 'ensembl_grch38' | 'gRNA.json' | 'shRNA.json';
  ensemblRelease?: string;
}

export async function enrichModuleWithSequence(
  module: Module,
  opts?: { base?: string; forceRefresh?: boolean; enforceTypeSource?: boolean }
): Promise<Module> {
  console.log(`[enrichModule] Starting enrichment for:`, module);
  try {
    if (module.type === 'knockdown') {
      console.log(`[enrichModule] Knockdown detected. Searching shRNA data for symbol: ${module.name}`);
      const shRNARecord = shRNAData.find(record => 
        record['Symbol']?.trim().toUpperCase() === module.name?.trim().toUpperCase()
      );
      if (shRNARecord && shRNARecord['Final shRNA Seq for\nCRISPR-All Syntax']) {
        const sequence = shRNARecord['Final shRNA Seq for\nCRISPR-All Syntax'].trim();
        console.log(`[enrichModule] Found shRNA sequence for ${module.name}`);
        return {
          ...module,
          sequence,
          sequenceSource: 'shRNA.json',
        };
      } else {
        console.warn(`[enrichModule] shRNA sequence not found for knockdown module: ${module.name}.`);
        
        // Check if gene is available for knockout instead
        const gRNARecord = gRNAData.find(record => record.geneSymbol?.trim().toUpperCase() === module.name?.trim().toUpperCase());
        if (gRNARecord && opts?.enforceTypeSource) {
          throw new Error(`shRNA sequence not found for ${module.name}. However, ${module.name} is available for knockout. Try "knockout ${module.name}" instead.`);
        } else if (opts?.enforceTypeSource) {
          throw new Error(`shRNA sequence not found for ${module.name}. This gene is not available for knockdown.`);
        }
        // Otherwise, fall through to Ensembl
      }
    }

    if (module.type === 'knockout') {
      console.log(`[enrichModule] Knockout detected. Searching gRNA data for symbol: ${module.name}`);
      const gRNARecord = gRNAData.find(record => record.geneSymbol?.trim().toUpperCase() === module.name?.trim().toUpperCase());
      if (gRNARecord && gRNARecord.gRNASequence) {
        const sequence = gRNARecord.gRNASequence;
        console.log(`[enrichModule] Found gRNA sequence for ${module.name}`);
        return {
          ...module,
          sequence,
          sequenceSource: 'gRNA.json',
        };
      } else {
        console.warn(`[enrichModule] gRNA sequence not found for knockout module: ${module.name}.`);
        
        // Check if gene is available for knockdown instead
        const shRNARecord = shRNAData.find(record => record['Symbol']?.trim().toUpperCase() === module.name?.trim().toUpperCase());
        if (shRNARecord && opts?.enforceTypeSource) {
          throw new Error(`gRNA sequence not found for ${module.name}. However, ${module.name} is available for knockdown. Try "knockdown ${module.name}" instead.`);
        } else if (opts?.enforceTypeSource) {
          throw new Error(`gRNA sequence not found for ${module.name}. This gene is not available for knockout.`);
        }
        // Otherwise, fall through to Ensembl
      }
    }

    // Fallback to Ensembl for non-knockdown modules
    console.log(`[enrichModule] Falling back to Ensembl for ${module.name} (type: ${module.type})`);
    const gene = await resolveGene(module.name, 'homo_sapiens', opts);
    
    const transcriptId = pickTranscript(gene);
    
    if (!transcriptId) {
      throw new Error(`No suitable transcript found for ${module.name}`);
    }

    const sequence = await fetchCdna(transcriptId, opts);
    console.log(`[enrichModule] Fetched sequence length: ${sequence.length}`);
    
    // Ensure we preserve the original module name and other properties
    return {
      ...module,
      name: module.name || gene.display_name || 'Unnamed',
      sequence,
      sequenceSource: 'ensembl_grch38',
      ensemblGeneId: gene.id,
      gene_id: gene.id,
      description: module.description || `Gene: ${gene.display_name || module.name}`
    };
  } catch (error) {
    console.error(`[enrichModule] Failed to enrich module ${module.name}:`, error);
    console.error(`Failed to enrich module ${module.name}:`, error);
    // Re-throw the error to be handled by the calling component
    throw error;
  }
}