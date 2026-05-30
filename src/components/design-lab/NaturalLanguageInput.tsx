import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { parseInstructions, EditInstruction } from '@/lib/llm/llmParser';
import { dispatchEdits, DispatchWarning, mapActionToModuleType } from '@/lib/llm/dispatcher';
import { Module } from '@/lib/types';
import { TypedHeading } from '@/components/ui/typed-heading';
import { StepBadge } from '@/components/ui/step-badge';

interface NaturalLanguageInputProps {
  onModulesGenerated: (modules: Module[]) => void;
  onError?: (error: string) => void;
}

export function NaturalLanguageInput({ onModulesGenerated, onError }: NaturalLanguageInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState<DispatchWarning[]>([]);
  const [previewModules, setPreviewModules] = useState<Module[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [originalInstructions, setOriginalInstructions] = useState<EditInstruction[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setWarnings([]);
    setPreviewModules([]);
    
    try {
      // Parse the instructions
      const instructions = await parseInstructions(input);
      setOriginalInstructions(instructions);
      
      // Immediately dispatch to get both modules and warnings
      const { modules, warnings: editWarnings } = await dispatchEdits(instructions, { enforceTypeSource: true });
      
      // Store modules and warnings
      setPreviewModules(modules);
      setWarnings(editWarnings);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error parsing instructions:', error);
      onError?.('Failed to parse instructions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (previewModules.length === 0) return;
    
    try {
      // Add all successful modules to the design
      onModulesGenerated(previewModules);

      // Clear the added modules to prevent accidental double-adds. If there are
      // unresolved warnings, keep the preview panel open so the user can still
      // pick alternatives; otherwise close it entirely.
      setPreviewModules([]);
      if (warnings.length === 0) {
        setShowPreview(false);
      }

    } catch (error) {
      console.error('Error adding modules:', error);
      onError?.('Failed to add modules. Please try again.');
    }
  };

  const handleSuggestionClick = async (warningIndex: number, alternative: string) => {
    const warning = warnings[warningIndex];
    if (!warning) return;

    const actionType = warning.action ?? 'overexpression';
    setIsLoading(true);

    try {
      // Find and replace the failed instruction with the alternative
      const updatedInstructions = originalInstructions.map(inst => {
        const instActionType = mapActionToModuleType(inst.action || '');
        // Match the original failed target
        if (warning.originalTarget && 
            inst.target.trim().toUpperCase() === warning.originalTarget.trim().toUpperCase() &&
            instActionType === actionType) {
          return {
            ...inst,
            target: alternative,
            description: `${actionType} ${alternative}`,
          };
        }
        return inst;
      });

      // Re-dispatch all instructions to maintain correct order
      setOriginalInstructions(updatedInstructions);
      const { modules, warnings: newWarnings } = await dispatchEdits(updatedInstructions, { enforceTypeSource: true });
      
      setPreviewModules(modules);
      setWarnings(newWarnings);
      
    } catch (error) {
      console.error('Error applying suggestion:', error);
      onError?.('Failed to apply suggestion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatActionLabel = (action?: string) => {
    if (!action) return 'Add';
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  const formatModuleType = (module: Module) => {
    // Synthetic genes and genes not naturally in the human genome should display as "Knock in"
    if (module.isSynthetic || module.type === 'knockin') {
      return 'Knock in';
    }
    // Format other types: overexpression -> Overexpression, knockout -> Knockout, etc.
    return module.type.charAt(0).toUpperCase() + module.type.slice(1);
  };

  return (
    <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StepBadge n={1} />
            <TypedHeading text="Desired Genetic Perturbation" className="text-xl font-bold text-gray-900 dark:text-white" />
          </div>
          <Textarea
            id="natural-language"
            placeholder="Describe your genetic modifications (e.g., 'overexpress BATF, knockdown IRF4')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="min-h-[100px]"
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          {showPreview && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(false)}
              disabled={isLoading}
            >
              Edit
            </Button>
          )}
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : showPreview ? (
              'Regenerate'
            ) : (
              'Generate Construct'
            )}
          </Button>
        </div>
      </form>

      {showPreview && (
        <div className="space-y-4">
          {previewModules.length > 0 && (
            <div className="rounded-md border p-4">
              <h4 className="mb-3 text-sm font-medium">Preview</h4>
              <ul className="space-y-2">
                {previewModules.map((module, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span>
                      <span className="font-medium">{formatModuleType(module)}</span> <code>{module.name}</code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription className="space-y-4">
                {warnings.map((warning, i) => (
                  <div key={i} className="space-y-2">
                    <p>{warning.message}</p>
                    {warning.alternatives && warning.alternatives.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Try instead:</span>
                        {warning.alternatives.map((alternative) => (
                          <Button
                            key={alternative}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuggestionClick(i, alternative)}
                            disabled={isLoading}
                          >
                            {formatActionLabel(warning.action)} {alternative}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {previewModules.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleConfirm} disabled={isLoading}>
                Confirm & Add to Design
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
    </Card>
  );
}
