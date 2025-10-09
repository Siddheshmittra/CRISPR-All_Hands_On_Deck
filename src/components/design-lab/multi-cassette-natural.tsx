import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Upload } from 'lucide-react';
import type { Module, LibrarySyntaxAddOptions } from '@/lib/types';
import { planLibrariesFromPrompt, type PlannedLibrary, type LibraryPlanType } from '@/lib/llm/libraryPlanner';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SyntheticDomainImporter } from './synthetic-domain-importer';
import type { SyntheticGene } from '@/lib/types';
import { LibraryViewer } from '@/components/design-lab/library-viewer';
import { TypedHeading } from '@/components/ui/typed-heading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const LIBRARY_LABELS: Record<LibraryPlanType, string> = {
  overexpression: 'Overexpression libraries',
  knockdown: 'Knockdown libraries',
  knockout: 'Knockout libraries',
  knockin: 'Knockin libraries',
};

const LIBRARY_SHORT_LABELS: Record<LibraryPlanType, string> = {
  overexpression: 'OE',
  knockdown: 'KD',
  knockout: 'KO',
  knockin: 'KI',
};

interface MultiCassetteNaturalProps {
  folders: Array<{ id: string; name: string; modules: string[]; open?: boolean }>;
  setFolders: (updater: any) => void;
  customModules: Module[];
  setCustomModules: (updater: any) => void;
  onAddLibrary: (libraryId: string, options?: LibrarySyntaxAddOptions) => void;
  setSelectedFolderId?: (id: string) => void; // ensure selector points at new folder
  maxPerLibrary?: number;
}

export function MultiCassetteNatural(props: MultiCassetteNaturalProps) {
  const { folders, setFolders, customModules, setCustomModules, onAddLibrary, setSelectedFolderId, maxPerLibrary = 30 } = props;
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [plans, setPlans] = useState<PlannedLibrary[] | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [syntheticDomains, setSyntheticDomains] = useState<SyntheticGene[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [libraryMixMode, setLibraryMixMode] = useState<'random' | 'custom'>('random');
  const [randomLibraryCount, setRandomLibraryCount] = useState(2);
  const perturbationTypes: LibraryPlanType[] = ['overexpression', 'knockdown', 'knockout', 'knockin'];
  const MAX_TOTAL_LIBRARIES = 15;
  const [customTypeCounts, setCustomTypeCounts] = useState<Record<LibraryPlanType, number>>({
    overexpression: 1,
    knockdown: 0,
    knockout: 0,
    knockin: 0,
  });
  const initialGenesPerLibrary = Math.min(maxPerLibrary, Math.max(4, Math.round(maxPerLibrary / 2)));
  const [genesPerLibrary, setGenesPerLibrary] = useState(initialGenesPerLibrary);
  const [perTypeGeneInputs, setPerTypeGeneInputs] = useState<Record<LibraryPlanType, string>>({
    overexpression: '',
    knockdown: '',
    knockout: '',
    knockin: '',
  });
  const handleDomainsImported = (domains: SyntheticGene[]) => {
    setSyntheticDomains(prev => [...prev, ...domains]);
    setShowImporter(false);
    toast.success(`Imported ${domains.length} synthetic domain${domains.length !== 1 ? 's' : ''}`);
  };

  const handlePlan = async () => {
    if (!prompt.trim()) return;

    const hasLibraryRequest = libraryMixMode === 'random'
      ? randomLibraryCount > 0
      : Object.values(customTypeCounts).some(count => count > 0);

    if (!hasLibraryRequest) {
      toast.error('Select at least one perturbation configuration before planning libraries.');
      return;
    }

    let totalCustomRequested = 0;
    const sanitizedCounts: Partial<Record<LibraryPlanType, number>> = {};
    if (libraryMixMode === 'custom') {
      perturbationTypes.forEach(type => {
        const raw = Math.floor(customTypeCounts[type] ?? 0);
        if (raw > 0) {
          sanitizedCounts[type] = raw;
          totalCustomRequested += raw;
        }
      });
    }

    const requestedTotal = libraryMixMode === 'custom'
      ? totalCustomRequested
      : Math.max(1, randomLibraryCount);

    if (requestedTotal > MAX_TOTAL_LIBRARIES) {
      toast.error(`You can request up to ${MAX_TOTAL_LIBRARIES} libraries at once. Adjust your counts before planning.`);
      if (libraryMixMode === 'random' && randomLibraryCount > MAX_TOTAL_LIBRARIES) {
        setRandomLibraryCount(MAX_TOTAL_LIBRARIES);
      }
      return;
    }

    const updatedInputs: Record<LibraryPlanType, string> = { ...perTypeGeneInputs };
    const sanitizedGeneOverrides: Partial<Record<LibraryPlanType, number>> = {};
    let hasInvalidGeneOverride = false;

    perturbationTypes.forEach((type) => {
      const raw = perTypeGeneInputs[type]?.trim();
      if (!raw) return;
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        hasInvalidGeneOverride = true;
        return;
      }
      const clamped = Math.max(1, Math.min(maxPerLibrary, parsed));
      sanitizedGeneOverrides[type] = clamped;
      if (String(clamped) !== raw) {
        updatedInputs[type] = String(clamped);
      }
    });

    if (hasInvalidGeneOverride) {
      toast.error('Enter valid gene counts for each perturbation override or leave the fields blank.');
      setPerTypeGeneInputs(updatedInputs);
      return;
    }

    setPerTypeGeneInputs(updatedInputs);
    setIsThinking(true);
    setPlans(null);
    try {
      console.log('Planning libraries for prompt:', prompt);
      const effectiveGenesPerLibrary = Math.max(1, Math.min(maxPerLibrary, Number.isFinite(genesPerLibrary) ? genesPerLibrary : maxPerLibrary));
      const basePreferences = libraryMixMode === 'custom'
        ? {
            libraryMix: 'custom' as const,
            typeCounts: sanitizedCounts,
            genesPerLibrary: effectiveGenesPerLibrary,
          }
        : {
            libraryMix: 'random' as const,
            totalLibraries: requestedTotal,
            genesPerLibrary: effectiveGenesPerLibrary,
          };

      const preferences = Object.keys(sanitizedGeneOverrides).length > 0
        ? { ...basePreferences, genesPerType: sanitizedGeneOverrides }
        : basePreferences;

      const result = await planLibrariesFromPrompt(prompt, {
        maxPerLibrary: maxPerLibrary,
        preferences,
      });
      console.log('Library planning result:', result);

      const normalizedPlans = Array.isArray(result)
        ? result.filter((plan): plan is PlannedLibrary => {
            if (!plan || typeof plan !== 'object') return false;
            if (!plan.name || !plan.type || !Array.isArray(plan.geneSymbols)) return false;
            return perturbationTypes.includes(plan.type);
          })
        : [];

      const cappedResult = normalizedPlans.slice(0, MAX_TOTAL_LIBRARIES);
      if (normalizedPlans.length > MAX_TOTAL_LIBRARIES) {
        toast.warning(`Showing the first ${MAX_TOTAL_LIBRARIES} libraries (hard cap).`);
      }
      setPlans(cappedResult);
      if (cappedResult.length === 0) {
        toast.message('No actionable libraries found from the prompt. Try being more specific about gene types or functions.');
      } else {
        toast.success(`Found ${cappedResult.length} library plan${cappedResult.length === 1 ? '' : 's'}`);
      }
    } catch (e: any) {
      console.error('Library planning error:', e);
      toast.error(e?.message || 'Failed to plan libraries. Check your API configuration.');
    } finally {
      setIsThinking(false);
    }
  };

  const totalCustomRequested = Object.values(customTypeCounts).reduce((acc, count) => acc + Math.max(0, Math.floor(count ?? 0)), 0);
  const customHasCounts = totalCustomRequested > 0;
  const totalRequested = libraryMixMode === 'custom' ? totalCustomRequested : Math.max(1, randomLibraryCount);
  const withinLibraryCap = totalRequested <= MAX_TOTAL_LIBRARIES;
  const canRequestLibraries = (libraryMixMode === 'random' ? randomLibraryCount > 0 : customHasCounts) && withinLibraryCap;

  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const applyPlans = async () => {
    if (!plans || plans.length === 0 || isApplying) return;
    setIsApplying(true);

    try {
      // Build new modules and folders; also add to Total Library
      const newModules: Module[] = [];
      const newFolders: Array<{ id: string; name: string; modules: string[]; open?: boolean }> = [];
      const totalLibraryIndex = folders.findIndex(f => f.id === 'total-library');
      const totalLibrary = totalLibraryIndex >= 0 ? { ...folders[totalLibraryIndex] } : { id: 'total-library', name: 'Total Library', modules: [], open: false };

      const skippedGenes: string[] = [];
      const warnings: string[] = [];

      for (const plan of plans) {
        const safeName = plan?.name?.trim() || `${LIBRARY_LABELS[plan.type]} (${plan.type.toUpperCase()})`;
        const slugBase = slugify(safeName) || `${plan.type}`;
        const folderId = `lib-${slugBase}-${uid()}`;
        const moduleIds: string[] = [];

        // If this is a knockin plan and synthetic domains exist, try matching by name/tag first
        const knockinDomains: SyntheticGene[] = plan.type === 'knockin' ? syntheticDomains : [];

        const geneSymbols = Array.isArray(plan.geneSymbols) ? plan.geneSymbols : [];
        if (geneSymbols.length === 0) continue;

        for (const gene of geneSymbols) {
          try {
            if (plan.type === 'knockin' && knockinDomains.length > 0) {
              const match = knockinDomains.find(domain =>
                domain.name.toLowerCase().includes(gene.toLowerCase()) ||
                domain.tags.some(t => t.toLowerCase().includes(gene.toLowerCase()))
              );
              if (match) {
                const syntheticModule: Module = {
                  id: `${match.name}-${uid()}`,
                  name: match.name,
                  type: 'knockin',
                  description: match.description,
                  sequence: match.sequence,
                  isSynthetic: true,
                  color: 'bg-green-100 text-green-800'
                };
                newModules.push(syntheticModule);
                moduleIds.push(syntheticModule.id);
                totalLibrary.modules.push(syntheticModule.id);
                continue;
              }
            }

            const base: Module = {
              id: `${gene}-${uid()}`,
              name: gene,
              type: plan.type,
              description: `${plan.type} ${gene} (planned: ${plan.name})`,
              sequence: '',
            };

            // Try with strict source enforcement first
            try {
              const enriched = await (await import('@/lib/ensembl')).enrichModuleWithSequence(base, { enforceTypeSource: true });
              newModules.push(enriched);
              moduleIds.push(enriched.id);
              totalLibrary.modules.push(enriched.id);
            } catch (strictError) {
              // If strict enforcement fails, try with fallback to Ensembl
              console.warn(`Strict source failed for ${gene}, trying fallback:`, strictError);

              try {
                const enriched = await (await import('@/lib/ensembl')).enrichModuleWithSequence(base, { enforceTypeSource: false });
                newModules.push(enriched);
                moduleIds.push(enriched.id);
                totalLibrary.modules.push(enriched.id);

                // Track that this gene used fallback sequence
                if (plan.type === 'knockdown') {
                  warnings.push(`${gene}: Using cDNA sequence (shRNA not available)`);
                } else if (plan.type === 'knockout') {
                  warnings.push(`${gene}: Using cDNA sequence (gRNA not available)`);
                }
              } catch (fallbackError) {
                console.error(`Both strict and fallback failed for ${gene}:`, fallbackError);
                skippedGenes.push(`${gene} (${plan.type})`);
              }
            }
          } catch (e) {
            console.error(`Failed to process gene ${gene}:`, e);
            skippedGenes.push(`${gene} (${plan.type})`);
          }
        }

        // Only create folder if it has modules
        if (moduleIds.length > 0) {
          newFolders.push({ id: folderId, name: safeName, modules: moduleIds, open: false });
        }
      }

      // Commit to state
      setCustomModules((prev: Module[]) => [...prev, ...newModules]);
      setFolders((prev: any[]) => {
        const nonTotal = prev.filter((f: any) => f.id !== 'total-library');
        const updated = [totalLibrary, ...nonTotal, ...newFolders];
        // Optional: point selection to first newly created library to make it visible
        try { setSelectedFolderId && setSelectedFolderId(newFolders[0]?.id || totalLibrary.id); } catch {}
        return updated;
      });

      // Add to library syntax with correct types
      for (let i = 0; i < Math.min(plans.length, newFolders.length); i++) {
        const plan = plans[i];
        const folderId = newFolders[i]?.id;
        if (folderId) {
          onAddLibrary(folderId, { type: plan.type });
        }
      }

      // Show comprehensive feedback
      let message = `Added ${newFolders.length} libraries with ${newModules.length} modules`;
      
      if (warnings.length > 0) {
        message += `\n⚠️ Using fallback sequences: ${warnings.length} genes`;
        console.warn('Fallback sequences used:', warnings);
      }
      
      if (skippedGenes.length > 0) {
        message += `\n❌ Skipped: ${skippedGenes.join(', ')}`;
        console.error('Skipped genes:', skippedGenes);
      }
      
      if (skippedGenes.length > 0) {
        toast.error(message);
      } else if (warnings.length > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch (error) {
      console.error('Failed to apply planned libraries:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while applying plans.';
      toast.error(`Failed to add planned libraries: ${errorMessage}`);
    } finally {
      setIsApplying(false);
    }
  };


  // Minimal toggle summary removed to keep UI compact

  return (
    <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <TypedHeading text="1. Desired Genetic Perturbations (Pooled)" className="text-xl font-bold text-gray-900 dark:text-white" />
        <Dialog open={showImporter} onOpenChange={setShowImporter}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import domains
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <SyntheticDomainImporter 
              onDomainsImported={handleDomainsImported}
              onClose={() => setShowImporter(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Describe the experiment</label>
          <Textarea
            placeholder="e.g., I want to knock in surface receptor genes, and knock out various transcription factor genes"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <Collapsible>
          <div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">Advanced</Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Perturbation mix</label>
                  <Select value={libraryMixMode} onValueChange={(value) => setLibraryMixMode(value as 'random' | 'custom')}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select mix" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Let the planner mix perturbation types</SelectItem>
                      <SelectItem value="custom">Specify counts for each perturbation type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Genes per library (max {maxPerLibrary})</label>
                  <Input
                    type="number"
                    min={1}
                    max={maxPerLibrary}
                    value={genesPerLibrary}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      if (Number.isNaN(next)) {
                        setGenesPerLibrary(1);
                        return;
                      }
                      setGenesPerLibrary(Math.max(1, Math.min(maxPerLibrary, next)));
                    }}
                  />
                </div>
            </div>
            {libraryMixMode === 'random' ? (
              <div className="mt-4 space-y-2 sm:max-w-xs">
                  <label className="text-sm font-medium text-muted-foreground">Approximate library count</label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_TOTAL_LIBRARIES}
                    value={randomLibraryCount}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      if (Number.isNaN(next)) {
                        setRandomLibraryCount(1);
                        return;
                      }
                      setRandomLibraryCount(Math.max(1, Math.min(MAX_TOTAL_LIBRARIES, next)));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Planner will aim for this many libraries (hard cap {MAX_TOTAL_LIBRARIES}), mixing types based on your prompt.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {perturbationTypes.map((type) => (
                  <div key={type} className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{LIBRARY_LABELS[type]}</label>
                    <Input
                      type="number"
                      min={0}
                      max={MAX_TOTAL_LIBRARIES}
                      value={customTypeCounts[type] ?? 0}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        setCustomTypeCounts((prev) => {
                          const clamped = Number.isNaN(next) ? 0 : Math.max(0, Math.min(MAX_TOTAL_LIBRARIES, Math.floor(next)));
                          const nextCounts = {
                            ...prev,
                            [type]: clamped,
                          };
                          const total = Object.values(nextCounts).reduce((sum, value) => sum + Math.max(0, Math.floor(value ?? 0)), 0);
                          if (total > MAX_TOTAL_LIBRARIES) {
                            toast.error(`Limit of ${MAX_TOTAL_LIBRARIES} libraries reached. Reduce other counts first.`);
                            return prev;
                          }
                          return nextCounts;
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-muted-foreground block">Genes per library overrides</label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {perturbationTypes.map((type) => (
                  <div key={`genes-${type}`} className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{LIBRARY_SHORT_LABELS[type]}</div>
                    <Input
                      type="number"
                      min={1}
                      max={maxPerLibrary}
                      placeholder={`Default: ${genesPerLibrary}`}
                      value={perTypeGeneInputs[type] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === '') {
                          setPerTypeGeneInputs((prev) => ({ ...prev, [type]: '' }));
                          return;
                        }
                        const parsed = Number.parseInt(value, 10);
                        if (Number.isNaN(parsed)) {
                          toast.error('Enter a valid number.');
                          return;
                        }
                        const clamped = Math.max(1, Math.min(maxPerLibrary, parsed));
                        if (clamped !== parsed) {
                          toast.message(`Clamped to ${clamped} (limit ${maxPerLibrary}).`);
                        }
                        setPerTypeGeneInputs((prev) => ({ ...prev, [type]: String(clamped) }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to reuse the global genes-per-library target.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex gap-2">
          <Button
            onClick={handlePlan}
            disabled={!prompt.trim() || isThinking || !canRequestLibraries}
            className="min-w-[180px]"
          >
            {isThinking ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Plan Libraries
              </>
            )}
          </Button>
          <Button variant="outline" disabled={!plans || plans.length === 0 || isApplying} onClick={applyPlans} className="min-w-[180px]">
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Apply to Workspace'
            )}
          </Button>
        </div>

        {plans && (
          <div className="mt-2 text-sm text-muted-foreground">
            {plans.length === 0 ? (
              <div>No libraries found.</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {plans.map((p) => (
                  <li key={p.name}>
                    <div>
                      <span className="font-medium">{p.name}</span> — {p.type} — {p.geneSymbols.length} genes
                      {p.criteria ? <span className="ml-1 italic">({p.criteria})</span> : null}
                    </div>
                    {p.sources && p.sources.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5 mt-1">
                        {p.sources.map((s, i) => (
                          <li key={i}>
                            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                              {s.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Embedded Planned Libraries inside the same block */}
      <LibraryViewer folders={folders} customModules={customModules} embedded />
    </Card>
  );
}
