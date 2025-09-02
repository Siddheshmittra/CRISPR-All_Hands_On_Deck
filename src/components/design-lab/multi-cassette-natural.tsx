import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Module } from '@/lib/types';
import { planLibrariesFromPrompt, type PlannedLibrary } from '@/lib/llm/libraryPlanner';
import { predictTCellFunction } from '@/lib/llm/predictFunction';
import { toast } from 'sonner';

interface MultiCassetteNaturalProps {
  folders: Array<{ id: string; name: string; modules: string[]; open?: boolean }>;
  setFolders: (updater: any) => void;
  customModules: Module[];
  setCustomModules: (updater: any) => void;
  onAddLibrary: (libraryId: string, type?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => void;
  setSelectedFolderId?: (id: string) => void; // ensure selector points at new folder
  maxPerLibrary?: number;
}

export function MultiCassetteNatural(props: MultiCassetteNaturalProps) {
  const { folders, setFolders, customModules, setCustomModules, onAddLibrary, setSelectedFolderId, maxPerLibrary = 30 } = props;
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [plans, setPlans] = useState<PlannedLibrary[] | null>(null);
  const [predictedSentence, setPredictedSentence] = useState<string>('');
  const [predictedSources, setPredictedSources] = useState<Array<{ title: string; url: string }>>([]);
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setIsThinking(true);
    setPlans(null);
    try {
      console.log('Planning libraries for prompt:', prompt);
      const result = await planLibrariesFromPrompt(prompt, maxPerLibrary);
      console.log('Library planning result:', result);
      setPlans(result);
      if (result.length === 0) {
        toast.message('No actionable libraries found from the prompt. Try being more specific about gene types or functions.');
      } else {
        toast.success(`Found ${result.length} library plan(s)`);
      }
    } catch (e: any) {
      console.error('Library planning error:', e);
      toast.error(e?.message || 'Failed to plan libraries. Check your API configuration.');
    } finally {
      setIsThinking(false);
    }
  };

  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const applyPlans = async () => {
    if (!plans || plans.length === 0) return;

    // Build new modules and folders; also add to Total Library
    const newModules: Module[] = [];
    const newFolders: Array<{ id: string; name: string; modules: string[]; open?: boolean }> = [];
    const totalLibraryIndex = folders.findIndex(f => f.id === 'total-library');
    const totalLibrary = totalLibraryIndex >= 0 ? { ...folders[totalLibraryIndex] } : { id: 'total-library', name: 'Total Library', modules: [], open: true };

    const skippedGenes: string[] = [];
    const warnings: string[] = [];

    for (const plan of plans) {
      const folderId = `lib-${slugify(plan.name)}-${uid()}`;
      const moduleIds: string[] = [];
      
      for (const gene of plan.geneSymbols) {
        try {
          const base: Module = {
            id: `${gene}-${uid()}`,
            name: gene,
            type: plan.type,
            description: `${plan.type} ${gene} (planned: ${plan.name})`,
            sequence: '',
          }
          
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
        newFolders.push({ id: folderId, name: plan.name, modules: moduleIds, open: true });
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
        onAddLibrary(folderId, plan.type);
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
  };

  const handlePredict = async () => {
    // Get all modules from Total Library to predict function
    const totalLibrary = folders.find(f => f.id === 'total-library');
    if (!totalLibrary || totalLibrary.modules.length === 0) {
      toast.error('No modules available for prediction');
      return;
    }
    
    const modulesToPredict = customModules.filter(m => totalLibrary.modules.includes(m.id));
    if (modulesToPredict.length === 0) {
      toast.error('No modules available for prediction');
      return;
    }
    
    setIsPredicting(true);
    try {
      const result = await predictTCellFunction(modulesToPredict);
      setPredictedSentence(result.sentence);
      setPredictedSources(result.sources || []);
      toast.success('Prediction generated successfully');
    } catch (error) {
      console.error('Prediction error:', error);
      setPredictedSentence('Prediction failed.');
      setPredictedSources([]);
      toast.error('Failed to generate prediction. Please try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">2. Natural language libraries</h2>
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
        <div className="flex gap-2">
          <Button onClick={handlePlan} disabled={!prompt.trim() || isThinking} className="min-w-[180px]">
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
          <Button variant="outline" disabled={!plans || plans.length === 0} onClick={applyPlans}>
            Apply to Workspace
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
                    <span className="font-medium">{p.name}</span> — {p.type} — {p.geneSymbols.length} genes
                    {p.criteria ? <span className="ml-1 italic">({p.criteria})</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Predict function section for multi-cassette natural mode */}
      {customModules.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold mb-2">Predicted Function / Predicted Cellular Program</h3>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm">
                {predictedSentence ? (
                  <span>{predictedSentence}</span>
                ) : (
                  <span className="text-muted-foreground">No prediction yet.</span>
                )}
              </div>
              {predictedSources && predictedSources.length > 0 && (
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {predictedSources.map((source, i) => (
                    <li key={i} className="text-sm">
                      <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Prediction based on all modules in Total Library ({customModules.length} modules)
              </p>
            </div>
            <div>
              <Button
                onClick={handlePredict}
                disabled={isPredicting || customModules.length === 0}
                className="px-3 py-2"
              >
                {isPredicting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Predicting...
                  </>
                ) : (
                  'Predict'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


