export interface CitationSource {
  title: string;
  url: string;
}

function sanitizeUrl(url?: string, doi?: string): string | null {
  const trimmed = (url || '').trim();
  if (trimmed) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    // If Crossref returns protocol-relative or bare DOI URLs, normalize them
    if (trimmed.startsWith('doi.org/')) return `https://${trimmed}`;
    if (trimmed.startsWith('10.')) return `https://doi.org/${trimmed}`;
  }
  if (doi && doi.trim()) {
    return `https://doi.org/${doi.trim()}`;
  }
  return null;
}

export function buildLibrarySearchQuery(input: {
  name?: string;
  type?: 'overexpression' | 'knockdown' | 'knockout' | 'knockin';
  criteria?: string;
  geneSymbols?: string[];
}): string {
  const terms: string[] = [];
  terms.push('T cell');
  if (input.name) terms.push(input.name);
  if (input.criteria) terms.push(input.criteria);
  // Add a small, representative set of genes to keep the query focused
  const genes = (input.geneSymbols || []).slice(0, 6);
  if (genes.length > 0) terms.push(genes.join(' '));

  // Map perturbation type to common literature phrasing
  switch (input.type) {
    case 'overexpression':
      terms.push('overexpression upregulation');
      break;
    case 'knockdown':
      terms.push('knockdown suppression RNAi');
      break;
    case 'knockout':
      terms.push('knockout CRISPR');
      break;
    case 'knockin':
      terms.push('knock-in insertion');
      break;
    default:
      break;
  }

  return terms.filter(Boolean).join(' ');
}

export async function fetchCrossrefSources(query: string, rows = 5): Promise<CitationSource[]> {
  try {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('rows', String(Math.max(1, rows * 2))); // fetch a few extra to filter
    params.set('select', 'title,URL,DOI,container-title,issued,subject');
    params.set('sort', 'score');
    params.set('order', 'desc');

    // Apply basic quality filters
    const filterParts = [
      'type:journal-article',
      'from-pub-date:2005-01-01',
    ];
    params.set('filter', filterParts.join(','));

    const res = await fetch(`https://api.crossref.org/works?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data?.message?.items || []) as Array<{
      title?: string[];
      URL?: string;
      DOI?: string;
      subject?: string[];
    }>;

    const results: CitationSource[] = [];
    for (const it of items) {
      const title = (it.title?.[0] || '').trim();
      const url = sanitizeUrl(it.URL, it.DOI);
      if (!title || !url) continue;
      // Prefer immunology-related papers when subject labels exist
      const isImmunology = (it.subject || []).some(s => /immunolog/i.test(s));
      results.push({ title, url });
      // Light prioritization is already handled by Crossref score; we just collect
    }

    return results.slice(0, rows);
  } catch {
    return [];
  }
}


