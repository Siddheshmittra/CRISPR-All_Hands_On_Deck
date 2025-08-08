import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';
import type { Module } from '@/lib/types';
import { planLibrariesFromPrompt, type PlannedLibrary } from '@/lib/llm/libraryPlanner';
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

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setIsThinking(true);
    setPlans(null);
    try {
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

  const applyPlans = async () => {
    if (!plans || plans.length === 0) return;

    // Build new modules and folders; also add to Total Library
    const newModules: Module[] = [];
    const newFolders: Array<{ id: string; name: string; modules: string[]; open?: boolean }> = [];
    const totalLibraryIndex = folders.findIndex(f => f.id === 'total-library');
    const totalLibrary = totalLibraryIndex >= 0 ? { ...folders[totalLibraryIndex] } : { id: 'total-library', name: 'Total Library', modules: [], open: true };

    for (const plan of plans) {
      const folderId = `lib-${slugify(plan.name)}-${uid()}`;
      const moduleIds: string[] = [];
      for (const gene of plan.geneSymbols) {
        const moduleId = `${gene}-${uid()}`;
        const m: Module = {
          id: moduleId,
          name: gene,
          type: plan.type,
          description: `${plan.type} ${gene} (planned: ${plan.name})`,
        };
        newModules.push(m);
        moduleIds.push(moduleId);
        // add to total library as well
        totalLibrary.modules.push(moduleId);
      }
      newFolders.push({ id: folderId, name: plan.name, modules: moduleIds, open: true });
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
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const folderId = newFolders[i].id;
      onAddLibrary(folderId, plan.type);
    }

    toast.success(`Added ${plans.length} libraries from plan`);
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
    </Card>
  );
}


