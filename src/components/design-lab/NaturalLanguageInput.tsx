import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { parseInstructions } from '@/lib/llm/llmParser';
import { dispatchEdits } from '@/lib/llm/dispatcher';
import { predictTCellFunction } from '@/lib/llm/predictFunction';
import { Module } from '@/lib/types';

interface NaturalLanguageInputProps {
  onModulesGenerated: (modules: Module[]) => void;
  onError?: (error: string) => void;
}

export function NaturalLanguageInput({ onModulesGenerated, onError }: NaturalLanguageInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<{action: string, target: string}[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedModules, setGeneratedModules] = useState<Module[]>([]);
  const [predictedSentence, setPredictedSentence] = useState<string>('');
  const [predictedSources, setPredictedSources] = useState<Array<{ title: string; url: string }>>([]);
  const [isPredicting, setIsPredicting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setWarnings([]);
    
    try {
      // First, parse the instructions
      const instructions = await parseInstructions(input);
      
      // Show preview of what will be created
      setPreview(instructions.map(({ action, target }) => ({ action, target })));
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error parsing instructions:', error);
      onError?.('Failed to parse instructions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    
    setIsLoading(true);
    
    try {
      // Convert preview back to instructions format
      const instructions = preview.map(({ action, target }) => ({
        action: action as any,
        target,
        description: `${action} ${target}`
      }));
      
      // Dispatch the edits to create modules with strict source validation
      const { modules, warnings: editWarnings } = await dispatchEdits(instructions, { enforceTypeSource: true });
      
      if (editWarnings.length > 0) {
        setWarnings(editWarnings);
      }
      
      if (modules.length > 0) {
        onModulesGenerated(modules);
        setGeneratedModules(modules);
        // Keep the input but hide preview
        setPreview([]);
        setShowPreview(false);
        // Clear previous predictions when new modules are generated
        setPredictedSentence('');
        setPredictedSources([]);
      }
      
    } catch (error) {
      console.error('Error generating modules:', error);
      onError?.('Failed to generate modules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredict = async () => {
    if (generatedModules.length === 0) return;
    
    setIsPredicting(true);
    try {
      const result = await predictTCellFunction(generatedModules);
      setPredictedSentence(result.sentence);
      setPredictedSources(result.sources || []);
    } catch (error) {
      console.error('Prediction error:', error);
      setPredictedSentence('Prediction failed.');
      setPredictedSources([]);
      onError?.('Failed to generate prediction. Please try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="natural-language" className="block text-sm font-medium">
            Natural Language Design
          </label>
          <Textarea
            id="natural-language"
            placeholder="Describe your genetic modifications (e.g., 'overexpress BATF, knockdown IRF4')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Describe the genetic modifications you want to make using natural language.
          </p>
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
          <div className="rounded-md border p-4">
            <h4 className="mb-3 text-sm font-medium">Preview</h4>
            <ul className="space-y-2">
              {preview.map((item, index) => (
                <li key={index} className="flex items-center justify-between">
                  <span className="capitalize">
                    <span className="font-medium">{item.action}</span> <code>{item.target}</code>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Confirm & Add to Design'
              )}
            </Button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription className="space-y-2">
            {warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {generatedModules.length > 0 && (
        <Card className="p-6">
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
                Prediction based on the generated modules: {generatedModules.map(m => m.name).join(', ')}
              </p>
            </div>
            <div>
              <Button
                onClick={handlePredict}
                disabled={isPredicting || generatedModules.length === 0}
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
        </Card>
      )}
    </div>
  );
}
