import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Plus, X, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SyntheticGene } from '@/lib/types';
import Papa from 'papaparse';

interface SyntheticDomainImporterProps {
  onDomainsImported: (domains: SyntheticGene[]) => void;
  onClose?: () => void;
}

interface DomainRow {
  name: string;
  sequence: string;
  description?: string;
  category?: string;
  tags?: string;
}

export function SyntheticDomainImporter({ onDomainsImported, onClose }: SyntheticDomainImporterProps) {
  const [importMode, setImportMode] = useState<'file' | 'manual'>('file');
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Manual entry state
  const [manualDomain, setManualDomain] = useState<DomainRow>({
    name: '',
    sequence: '',
    description: '',
    category: 'custom',
    tags: ''
  });

  const validateSequence = (seq: string): boolean => {
    // Basic DNA sequence validation (A, T, G, C, N allowed)
    return /^[ATGCN]+$/i.test(seq.replace(/\s/g, ''));
  };

  const parseCSVFile = (file: File) => {
    setIsProcessing(true);
    setErrors([]);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newDomains: DomainRow[] = [];
        const parseErrors: string[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const name = row.name || row.Name || row.domain_name || row['Domain Name'] || '';
          const sequence = row.sequence || row.Sequence || row.seq || row.DNA || '';
          const description = row.description || row.Description || row.desc || '';
          const category = row.category || row.Category || 'custom';
          const tags = row.tags || row.Tags || '';
          
          if (!name.trim()) {
            parseErrors.push(`Row ${index + 1}: Missing name`);
            return;
          }
          
          if (!sequence.trim()) {
            parseErrors.push(`Row ${index + 1}: Missing sequence`);
            return;
          }
          
          const cleanSequence = sequence.replace(/\s/g, '').toUpperCase();
          if (!validateSequence(cleanSequence)) {
            parseErrors.push(`Row ${index + 1}: Invalid DNA sequence for ${name}`);
            return;
          }
          
          newDomains.push({
            name: name.trim(),
            sequence: cleanSequence,
            description: description.trim(),
            category: category.trim() || 'custom',
            tags: tags.trim()
          });
        });
        
        setDomains(newDomains);
        setErrors(parseErrors);
        setIsProcessing(false);
        
        if (parseErrors.length === 0 && newDomains.length > 0) {
          toast.success(`Successfully parsed ${newDomains.length} domains`);
        }
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
        setIsProcessing(false);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    
    parseCSVFile(file);
  };

  const addManualDomain = () => {
    const { name, sequence, description, category, tags } = manualDomain;
    
    if (!name.trim()) {
      toast.error('Domain name is required');
      return;
    }
    
    if (!sequence.trim()) {
      toast.error('Sequence is required');
      return;
    }
    
    const cleanSequence = sequence.replace(/\s/g, '').toUpperCase();
    if (!validateSequence(cleanSequence)) {
      toast.error('Invalid DNA sequence. Only A, T, G, C, N characters allowed.');
      return;
    }
    
    const newDomain: DomainRow = {
      name: name.trim(),
      sequence: cleanSequence,
      description: description?.trim() || '',
      category: category?.trim() || 'custom',
      tags: tags?.trim() || ''
    };
    
    setDomains(prev => [...prev, newDomain]);
    setManualDomain({ name: '', sequence: '', description: '', category: 'custom', tags: '' });
    toast.success(`Added domain: ${newDomain.name}`);
  };

  const removeDomain = (index: number) => {
    setDomains(prev => prev.filter((_, i) => i !== index));
  };

  const importDomains = () => {
    if (domains.length === 0) {
      toast.error('No domains to import');
      return;
    }
    
    const syntheticGenes: SyntheticGene[] = domains.map((domain, index) => ({
      id: `custom-${Date.now()}-${index}`,
      name: domain.name,
      description: domain.description || `Custom synthetic domain: ${domain.name}`,
      sequence: domain.sequence,
      category: domain.category || 'custom',
      tags: domain.tags ? domain.tags.split(',').map(t => t.trim()) : ['custom', 'imported']
    }));
    
    onDomainsImported(syntheticGenes);
    toast.success(`Imported ${syntheticGenes.length} synthetic domains`);
    onClose?.();
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Import Synthetic Domains</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="space-y-6">
        {/* Import Mode Selection */}
        <div className="flex gap-4">
          <Button 
            variant={importMode === 'file' ? 'default' : 'outline'}
            onClick={() => setImportMode('file')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import from CSV
          </Button>
          <Button 
            variant={importMode === 'manual' ? 'default' : 'outline'}
            onClick={() => setImportMode('manual')}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Manually
          </Button>
        </div>

        {/* CSV Import */}
        {importMode === 'file' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-upload">Upload CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Expected columns: name, sequence, description (optional), category (optional), tags (optional)
              </p>
            </div>
            
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Example:</strong><br />
                name,sequence,description,category,tags<br />
                CAR-CD19,ATGCGATCG...,Anti-CD19 CAR domain,therapeutic,CAR,CD19<br />
                GFP-Linker,GGCAGCGGC...,GFP with flexible linker,reporter,GFP,linker
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Manual Entry */}
        {importMode === 'manual' && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manual-name">Domain Name *</Label>
                <Input
                  id="manual-name"
                  value={manualDomain.name}
                  onChange={(e) => setManualDomain(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., CAR-CD19"
                />
              </div>
              <div>
                <Label htmlFor="manual-category">Category</Label>
                <Input
                  id="manual-category"
                  value={manualDomain.category}
                  onChange={(e) => setManualDomain(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., therapeutic, reporter, custom"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="manual-sequence">DNA Sequence *</Label>
              <Textarea
                id="manual-sequence"
                value={manualDomain.sequence}
                onChange={(e) => setManualDomain(prev => ({ ...prev, sequence: e.target.value }))}
                placeholder="Enter DNA sequence (A, T, G, C, N only)"
                className="font-mono text-sm h-24"
              />
            </div>
            
            <div>
              <Label htmlFor="manual-description">Description</Label>
              <Input
                id="manual-description"
                value={manualDomain.description}
                onChange={(e) => setManualDomain(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the domain"
              />
            </div>
            
            <div>
              <Label htmlFor="manual-tags">Tags (comma-separated)</Label>
              <Input
                id="manual-tags"
                value={manualDomain.tags}
                onChange={(e) => setManualDomain(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="e.g., CAR, CD19, therapeutic"
              />
            </div>
            
            <Button onClick={addManualDomain} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {errors.map((error, i) => (
                  <div key={i}>{error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview */}
        {domains.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Preview ({domains.length} domains)</h3>
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {domains.map((domain, index) => (
                <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                  <div className="flex-1">
                    <div className="font-medium">{domain.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {domain.sequence.length} bp • {domain.category}
                      {domain.description && ` • ${domain.description}`}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeDomain(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={importDomains} 
            disabled={domains.length === 0}
            className="flex-1"
          >
            Import {domains.length} Domain{domains.length !== 1 ? 's' : ''}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
