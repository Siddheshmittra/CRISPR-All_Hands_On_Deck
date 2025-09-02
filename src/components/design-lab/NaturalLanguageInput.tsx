import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { parseInstructions } from '@/lib/llm/llmParser';
import { dispatchEdits } from '@/lib/llm/dispatcher';
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
      
      // Dispatch the edits to create modules
      const { modules, warnings: editWarnings } = await dispatchEdits(instructions);
      
      if (editWarnings.length > 0) {
        setWarnings(editWarnings);
      }
      
      if (modules.length > 0) {
        onModulesGenerated(modules);
        // Keep the input but hide preview
        setPreview([]);
        setShowPreview(false);
      }
      
    } catch (error) {
      console.error('Error generating modules:', error);
      onError?.('Failed to generate modules. Please try again.');
    } finally {
      setIsLoading(false);
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
    </div>
  );
}
