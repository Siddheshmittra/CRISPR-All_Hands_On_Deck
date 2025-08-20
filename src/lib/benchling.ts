// Minimal Benchling integration via API Token (no OAuth)
// Stores config in localStorage and exposes helpers to import/export DNA sequences

export interface BenchlingConfig {
  baseUrl: string; // e.g., https://your-tenant.benchling.com/api
  apiToken: string; // X-Benchling-API-Token
}

const STORAGE_KEY = 'benchling:config:v1';

export function setBenchlingConfig(cfg: BenchlingConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function getBenchlingConfig(): BenchlingConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.baseUrl || !parsed?.apiToken) return null;
    return parsed as BenchlingConfig;
  } catch {
    return null;
  }
}

export function clearBenchlingConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

function buildHeaders(cfg: BenchlingConfig): HeadersInit {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Benchling-API-Token': cfg.apiToken,
  };
}

function join(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export async function testBenchlingConnection(cfg?: BenchlingConfig): Promise<boolean> {
  const conf = cfg || getBenchlingConfig();
  if (!conf) return false;
  try {
    const url = join(conf.baseUrl, '/v2/dna-sequences?limit=1');
    const r = await fetch(url, { headers: buildHeaders(conf) });
    return r.ok;
  } catch {
    return false;
  }
}

export interface ListSequencesParams {
  folderId?: string;
  limit?: number;
}

export async function listDNASequences(params: ListSequencesParams = {}): Promise<Array<{ id: string; name: string; bases: string }>> {
  const conf = getBenchlingConfig();
  if (!conf) throw new Error('Benchling not configured');
  const q = new URLSearchParams();
  if (params.folderId) q.set('folderId', params.folderId);
  q.set('limit', String(params.limit ?? 50));
  const url = join(conf.baseUrl, `/v2/dna-sequences?${q.toString()}`);
  const r = await fetch(url, { headers: buildHeaders(conf) });
  if (!r.ok) throw new Error(`Benchling list failed: ${r.status}`);
  const data: any = await r.json();
  const items = Array.isArray(data?.dnaSequences) ? data.dnaSequences : (Array.isArray(data?.results) ? data.results : []);
  return items.map((it: any) => ({ id: it.id || it.entityId || it.benchlingId || '', name: it.name || it.displayId || 'Sequence', bases: it.bases || it.sequence || '' }));
}

export async function createDNASequence(input: { name: string; bases: string; folderId?: string }): Promise<{ id: string }> {
  const conf = getBenchlingConfig();
  if (!conf) throw new Error('Benchling not configured');
  const url = join(conf.baseUrl, '/v2/dna-sequences');
  const body: any = { name: input.name, bases: input.bases };
  if (input.folderId) body.folderId = input.folderId;
  const r = await fetch(url, { method: 'POST', headers: buildHeaders(conf), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Benchling create failed: ${r.status}`);
  const data: any = await r.json();
  return { id: data?.id || data?.entityId || '' };
}


