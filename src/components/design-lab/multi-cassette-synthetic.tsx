import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Upload, Plus } from 'lucide-react';
import type { Module, SyntheticGene } from '@/lib/types';
import { planLibrariesFromPrompt, type PlannedLibrary } from '@/lib/llm/libraryPlanner';
import { SyntheticDomainImporter } from './synthetic-domain-importer';
import { toast } from 'sonner';

interface MultiCassetteSyntheticProps {
  folders: Array<{ id: string; name: string; modules: string[]; open?: boolean }>;
  setFolders: (updater: any) => void;
  customModules: Module[];
  setCustomModules: (updater: any) => void;
  onAddLibrary: (libraryId: string, type?: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => void;
  setSelectedFolderId?: (id: string) => void;
  maxPerLibrary?: number;
}

export function MultiCassetteSynthetic(props: MultiCassetteSyntheticProps) {
  const { folders, setFolders, customModules, setCustomModules, onAddLibrary, setSelectedFolderId, maxPerLibrary = 30 } = props;
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [plans, setPlans] = useState<PlannedLibrary[] | null>(null);
  const [syntheticDomains, setSyntheticDomains] = useState<SyntheticGene[]>([]);
  const [showImporter, setShowImporter] = useState(false);

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setIsThinking(true);
    setPlans(null);
    
    try {
      // Enhanced planning that considers synthetic domains
      const result = await planLibrariesFromPrompt(prompt, maxPerLibrary);
      setPlans(result);
      
      if (result.length === 0) {
        toast.message('No actionable libraries found from the prompt');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to plan libraries');
    } finally {
      setIsThinking(false);
    }
  };

  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const handleDomainsImported = (domains: SyntheticGene[]) => {
    setSyntheticDomains(prev => [...prev, ...domains]);
    setShowImporter(false);
  };

  const createSyntheticModule = (domain: SyntheticGene): Module => {
    return {
      id: `synthetic-${domain.id}-${uid()}`,
      name: domain.name,
      type: 'knockin',
      description: domain.description,
      sequence: domain.sequence,
      isSynthetic: true,
      sequenceSource: undefined, // Custom synthetic sequence
      color: 'bg-green-100 text-green-800'
    };
  };

  const applyPlansWithSynthetic = async () => {
    if (!plans || plans.length === 0) return;

    const newModules: Module[] = [];
    const newFolders: Array<{ id: string; name: string; modules: string[]; open?: boolean }> = [];
    const totalLibraryIndex = folders.findIndex(f => f.id === 'total-library');
    const totalLibrary = totalLibraryIndex >= 0 ? { ...folders[totalLibraryIndex] } : { id: 'total-library', name: 'Total Library', modules: [], open: true };

    for (const plan of plans) {
      const folderId = `lib-${slugify(plan.name)}-${uid()}`;
      const moduleIds: string[] = [];

      // Process natural genes
      for (const gene of plan.geneSymbols) {
        try {
          if (plan.type === 'knockin') {
            // For knockin, try to find matching synthetic domain first
            const matchingDomain = syntheticDomains.find(domain => 
              domain.name.toLowerCase().includes(gene.toLowerCase()) ||
              domain.tags.some(tag => tag.toLowerCase().includes(gene.toLowerCase())) ||
              gene.toLowerCase().includes(domain.name.toLowerCase())
            );

            if (matchingDomain) {
              const syntheticModule = createSyntheticModule(matchingDomain);
              newModules.push(syntheticModule);
              moduleIds.push(syntheticModule.id);
              totalLibrary.modules.push(syntheticModule.id);
              continue;
            }
          }

          // Standard gene processing for non-synthetic
          const base: Module = {
            id: `${gene}-${uid()}`,
            name: gene,
            type: plan.type,
            description: `${plan.type} ${gene} (planned: ${plan.name})`,
          };

          const enriched = await (await import('@/lib/ensembl')).enrichModuleWithSequence(base, { 
            enforceTypeSource: true 
          });
          
          newModules.push(enriched);
          moduleIds.push(enriched.id);
          totalLibrary.modules.push(enriched.id);
        } catch (e) {
          console.warn('Skipping gene without sequence', gene, e);
        }
      }

      // Add any remaining synthetic domains as knockins if this is a knockin library
      if (plan.type === 'knockin' && syntheticDomains.length > 0) {
        const remainingDomains = syntheticDomains.filter(domain => 
          !newModules.some(module => module.name === domain.name)
        ).slice(0, Math.max(0, maxPerLibrary - moduleIds.length));

        for (const domain of remainingDomains) {
          const syntheticModule = createSyntheticModule(domain);
          newModules.push(syntheticModule);
          moduleIds.push(syntheticModule.id);
          totalLibrary.modules.push(syntheticModule.id);
        }
      }

      if (moduleIds.length > 0) {
        newFolders.push({ id: folderId, name: plan.name, modules: moduleIds, open: true });
      }
    }

    // Commit to state
    setCustomModules((prev: Module[]) => [...prev, ...newModules]);
    setFolders((prev: any[]) => {
      const nonTotal = prev.filter((f: any) => f.id !== 'total-library');
      const updated = [totalLibrary, ...nonTotal, ...newFolders];
      try { 
        setSelectedFolderId && setSelectedFolderId(newFolders[0]?.id || totalLibrary.id); 
      } catch {}
      return updated;
    });

    // Add to library syntax
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const folderId = newFolders[i]?.id;
      if (folderId) {
        onAddLibrary(folderId, plan.type);
      }
    }

    toast.success(`Added ${plans.length} libraries with ${newModules.length} modules (${newModules.filter(m => m.isSynthetic).length} synthetic)`);
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">3. Natural Language + Synthetic Domains</h2>
      
      <div className="space-y-4">
        {/* Synthetic Domains Management */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <span className="font-medium">Synthetic Domains: {syntheticDomains.length}</span>
            {syntheticDomains.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {syntheticDomains.slice(0, 3).map(d => d.name).join(', ')}
                {syntheticDomains.length > 3 && ` +${syntheticDomains.length - 3} more`}
              </div>
            )}
          </div>
          <Dialog open={showImporter} onOpenChange={setShowImporter}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import Domains
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

        {/* Natural Language Input */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Describe the experiment (mention synthetic domains, knockins, etc.)
          </label>
          <Textarea
            placeholder="e.g., I want to knock in CAR domains for different targets, and knock out various checkpoint genes"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handlePlan} 
            disabled={!prompt.trim() || isThinking} 
            className="min-w-[180px]"
          >
            {isThinking ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Planning...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Plan Libraries
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            disabled={!plans || plans.length === 0} 
            onClick={applyPlansWithSynthetic}
          >
            <Plus className="h-4 w-4 mr-2" />
            Apply to Workspace
          </Button>
        </div>

        {/* Plans Preview */}
        {plans && (
          <div className="mt-4 text-sm text-muted-foreground">
            {plans.length === 0 ? (
              <div>No libraries found.</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {plans.map((p) => (
                  <li key={p.name}>
                    <span className="font-medium">{p.name}</span> — {p.type} — {p.geneSymbols.length} genes
                    {p.type === 'knockin' && syntheticDomains.length > 0 && (
                      <span className="ml-2 text-green-600">+ {syntheticDomains.length} synthetic domains available</span>
                    )}
                    {p.criteria ? <span className="ml-1 italic">({p.criteria})</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
