import React, { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Upload, Plus, Trash2, Edit3, Check, X, RefreshCw, FolderPlus, ChevronDown, Loader2 } from "lucide-react"
import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { Module, EnsemblModule } from "@/lib/types"
import { BenchlingButton } from "@/components/ui/benchling-button"
import { SyntheticGeneSelector } from "./synthetic-gene-selector"
import { SyntheticGene } from "@/lib/types"
import { UnifiedGeneSearch } from "./unified-gene-search"
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface ModuleSelectorProps {
  selectedModules: Module[]
  onModuleSelect: (module: Module) => void
  onModuleDeselect: (moduleId: string) => void
  customModules: Module[]
  onCustomModulesChange: (modules: Module[]) => void
  folders: any[]
  setFolders: (folders: any[]) => void
  handleModuleClick: (module: Module) => void
  hideTypeSelector?: boolean
}

export const ModuleSelector = ({ selectedModules, onModuleSelect, onModuleDeselect, customModules, onCustomModulesChange, folders, setFolders, handleModuleClick, hideTypeSelector = false }: ModuleSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [addingGenes, setAddingGenes] = useState<{[key: string]: boolean}>({})
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameCache = useRef<Map<string, string>>(new Map())
  let searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null)
  const [addingModule, setAddingModule] = useState(false)
  const [showSyntheticSelector, setShowSyntheticSelector] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState<string>('')
  const [convertingFolderId, setConvertingFolderId] = useState<string | null>(null)
  const [conversionType, setConversionType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin' | 'synthetic'>('overexpression')
  const geneFileInputRef = useRef<HTMLInputElement>(null)
  
  // Scan genes dialog state
  const [showScanGenesDialog, setShowScanGenesDialog] = useState(false)
  const [geneTextInput, setGeneTextInput] = useState('')
  const [scanGenesLibraryName, setScanGenesLibraryName] = useState('')
  const [scanGenesPerturbationType, setScanGenesPerturbationType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin'>('overexpression')
  
  // Type selector state
  const [selectedType, setSelectedType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin'>('overexpression')
  const typeOptions = [
    { 
      value: 'overexpression', 
      label: 'OE',
      className: 'bg-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,40%)] text-foreground',
      outlineClassName: 'text-[hsl(66,70%,47%)] border-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,47%)]/10'
    },
    { 
      value: 'knockout', 
      label: 'KO',
      className: 'bg-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,50%)] text-white',
      outlineClassName: 'text-[hsl(13,95%,59%)] border-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,59%)]/10'
    },
    { 
      value: 'knockdown', 
      label: 'KD',
      className: 'bg-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,40%)] text-white',
      outlineClassName: 'text-[hsl(32,75%,49%)] border-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,49%)]/10'
    },
    { 
      value: 'knockin', 
      label: 'KI*',
      className: 'bg-[hsl(220,35%,65%)] hover:bg-[hsl(220,35%,55%)] text-foreground',
      outlineClassName: 'text-[hsl(220,35%,65%)] border-[hsl(220,35%,65%)] hover:bg-[hsl(220,35%,65%)]/10'
    },
  ]

  const [newFolderName, setNewFolderName] = useState("")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isBenchlingLinked, setIsBenchlingLinked] = useState(false)
  const [isBenchlingLinking, setIsBenchlingLinking] = useState(false)

  // Compute modules not in any folder
  const folderedModuleIds = folders.flatMap(f => f.modules)
  const unassignedModules = customModules.filter(m => !folderedModuleIds.includes(m.id))

  function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const newId = Date.now() + '-' + Math.random()
    setFolders([
      ...folders,
      { id: newId, name: newFolderName.trim(), modules: [], open: true }
    ])
    setNewFolderName("")
    setActiveFolderId(newId)
    setSelectedFolderId(newId)
  }
  
  function handleToggleFolder(id: string) {
    setFolders(folders.map(f => f.id === id ? { ...f, open: !f.open } : f))
    setActiveFolderId(id)
  }

  const handleBenchlingLink = () => {
    setIsBenchlingLinking(true)
    setTimeout(() => {
      setIsBenchlingLinking(false)
      setIsBenchlingLinked(true)
      toast.success("Benchling account linked successfully!")
    }, 2000)
  }
  
  // Fetch suggestions from HGNC
  async function hgncSuggest(query: string) {
    if (query.length < 2) return []
    const JSON_HDR = { headers: { "Accept": "application/json" } }
    const searchURL = `https://rest.genenames.org/search/${encodeURIComponent(query)}`
    const sRes = await fetch(searchURL, JSON_HDR).then(r => r.json())
    const hits = (sRes.response?.docs || []).slice(0, 10)
    const promises = hits.map(async ({ hgnc_id, symbol }) => {
      if (nameCache.current.has(symbol)) return { symbol, name: nameCache.current.get(symbol), hgnc_id }
      const fURL = `https://rest.genenames.org/fetch/symbol/${encodeURIComponent(symbol)}`
      const fRes = await fetch(fURL, JSON_HDR).then(r => r.json())
      const name = fRes.response?.docs?.[0]?.name || "(name unavailable)"
      nameCache.current.set(symbol, name)
      return { symbol, name, hgnc_id }
    })
    return Promise.all(promises)
  }

  // Handle input changes and fetch suggestions
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (searchTerm.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    // Reduced timeout for more responsive feel
    searchTimeout.current = setTimeout(async () => {
      const items = await hgncSuggest(searchTerm)
      setSuggestions(items)
      setShowDropdown(true)
      setLoading(false)
      setSelectedIndex(-1)
    }, 150) // Faster response time
    // eslint-disable-next-line
  }, [searchTerm])

  // Keyboard navigation for dropdown
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault() // Prevent form submission if in a form
      if (showDropdown && suggestions.length > 0) {
        // If the dropdown is open, select the first suggestion and add it
        selectSuggestion(suggestions[0])
        // Use a timeout to allow the state to update before adding the gene
        setTimeout(() => handleAddModule(), 50) 
      } else if (selectedSuggestion) { 
        // If a suggestion is already selected, just add it
        handleAddModule()
      }
    } else if (showDropdown && suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex(idx => (idx + 1) % suggestions.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(idx => (idx - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === "Escape") {
        setShowDropdown(false)
      }
    }
  }

  function selectSuggestion(suggestion: any) {
    setSearchTerm(suggestion.symbol)
    setShowDropdown(false)
    setSuggestions([])
    setSelectedSuggestion(suggestion)
  }

  // Handler for unified gene search component
  const handleUnifiedModuleAdd = async (module: Module) => {
    try {
      // For knockin modules, show synthetic gene selector
      if (module.type === 'knockin') {
        setSelectedType('knockin')
        setShowSyntheticSelector(true)
        return
      }
      
      // Add module to the library
      onCustomModulesChange([...customModules, module])
      toast.success(`Added ${module.name} to library`)
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error("Failed to add module")
    }
  }

  const handleAddModule = async () => {
    if (!selectedSuggestion || addingModule) return
    
    const geneId = selectedSuggestion.symbol
    setAddingModule(true)
    setIsLibraryLoading(true)
    setAddingGenes(prev => ({ ...prev, [geneId]: true }))
    
    try {
      let moduleToAdd = selectedSuggestion
      
      // For knockin modules, show synthetic gene selector
      if (selectedType === 'knockin') {
        setShowSyntheticSelector(true)
        setAddingModule(false)
        setAddingGenes(prev => ({ ...prev, [geneId]: false }))
        return
      }
      
      // For other module types, proceed as normal
      const newModule: Module = {
        id: `${moduleToAdd.symbol}-${Date.now()}`,
        name: moduleToAdd.symbol,
        type: selectedType,
        description: moduleToAdd.description || `Human gene ${moduleToAdd.symbol}`,
        sequence: moduleToAdd.sequence || '',
        isEnriching: true // Mark as enriching to show loading state
      }
      
      // Add the module immediately with loading state
      onCustomModulesChange([...customModules, newModule])
      
      // Enrich the module in the background
      try {
        const enrichedModule = await enrichModuleWithSequence(newModule)
        onCustomModulesChange(customModules.map(m => 
          m.id === newModule.id ? { ...enrichedModule, isEnriching: false } : m
        ))
        toast.success(`Added ${moduleToAdd.symbol} to library`)
      } catch (error) {
        console.error(`Failed to enrich ${moduleToAdd.symbol}:`, error)
        toast.warning(`Added ${moduleToAdd.symbol} but sequence enrichment failed`)
      }
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error(`Failed to add ${selectedSuggestion?.symbol || 'module'}`)
    } finally {
      setAddingModule(false)
      setIsLibraryLoading(false)
      if (selectedSuggestion?.symbol) {
        setAddingGenes(prev => ({ ...prev, [selectedSuggestion.symbol]: false }))
      }
    }
  }

  const handleSyntheticGeneSelect = (gene: SyntheticGene) => {
    const newModule: Module = {
      id: `${gene.name}-${Date.now()}`,
      name: gene.name,
      type: 'knockin',
      description: gene.description,
      sequence: gene.sequence,
      isSynthetic: true,
      syntheticSequence: gene.sequence
    }
    
    onCustomModulesChange([...customModules, newModule])
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success(`Added synthetic gene ${gene.name} to library`)
  }

  const handleCustomSequence = (sequence: string) => {
    const newModule: Module = {
      id: `custom-synthetic-${Date.now()}`,
      name: "Custom Synthetic Gene",
      type: 'knockin',
      description: "Custom synthetic gene sequence",
      sequence: sequence,
      isSynthetic: true,
      syntheticSequence: sequence
    }
    
    onCustomModulesChange([...customModules, newModule])
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success("Added custom synthetic gene to library")
  }

  function handleDeleteModule(moduleId: string, folderId: string) {
    if (folderId === 'total-library') {
      // Remove from customModules (parent will update folders and construct)
      onCustomModulesChange(customModules.filter(m => m.id !== moduleId))
      toast.success('Module removed from all libraries')
    } else {
      // Remove only from this folder
      setFolders(folders.map(folder =>
        folder.id === folderId
          ? { ...folder, modules: folder.modules.filter(id => id !== moduleId) }
          : folder
      ))
      toast.success('Module removed from library')
    }
  }

  const handleStartEditingFolder = (folderId: string, currentName: string) => {
    if (folderId === 'total-library') return;
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleSaveFolderName = () => {
    if (!editingFolderId || !editingFolderName.trim()) return
    
    setFolders(folders.map(folder => 
      folder.id === editingFolderId 
        ? { ...folder, name: editingFolderName.trim() }
        : folder
    ))
    
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  const handleStartConversion = (folderId: string) => {
    setConvertingFolderId(folderId)
  }

  const handleConfirmConversion = async () => {
    if (!convertingFolderId) return
    
    const folder = folders.find(f => f.id === convertingFolderId)
    if (!folder || folder.id === 'total-library') return
    
    // Get all modules in this folder
    const folderModules = customModules.filter(m => folder.modules.includes(m.id))
    
    // Convert all modules to the new type
    const convertedModules = folderModules.map(module => ({
      ...module,
      type: conversionType
    }))
    
    // Update the customModules array
    onCustomModulesChange(customModules.map(module => {
      const convertedModule = convertedModules.find(cm => cm.id === module.id)
      return convertedModule || module
    }))
    
    // Update folder name to reflect conversion if it contains the old type
    const oldTypeNames = {
      overexpression: ['overexpression', 'overexp', 'oe'],
      knockout: ['knockout', 'ko'],
      knockdown: ['knockdown', 'kd'],
      knockin: ['knockin', 'ki'],
      synthetic: ['synthetic', 'synth']
    }
    
    let newFolderName = folder.name
    Object.entries(oldTypeNames).forEach(([type, variations]) => {
      if (type !== conversionType) {
        variations.forEach(variation => {
          const regex = new RegExp(`\\b${variation}\\b`, 'gi')
          newFolderName = newFolderName.replace(regex, conversionType)
        })
      }
    })
    
    // Update folder name if it changed
    if (newFolderName !== folder.name) {
      setFolders(folders.map(f => 
        f.id === convertingFolderId 
          ? { ...f, name: newFolderName }
          : f
      ))
    }
    
    setConvertingFolderId(null)
    toast.success(`Converted ${folderModules.length} modules to ${conversionType}`)
  }

  const handleCancelConversion = () => {
    setConvertingFolderId(null)
  }

  const handleGeneFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.(csv|xlsx)$/, '');
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = e.target?.result;
        if (typeof data !== 'string' && !(data instanceof ArrayBuffer)) {
            toast.error("Failed to read file.");
            setLoading(false);
            return;
        }

        try {
                        let rows: any[] = [];
                        if (file.name.endsWith('.csv')) {
                Papa.parse(data as string, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        // Always use the selected perturbation type from the dialog
                        const processedRows = results.data.map((row: any) => ({
                            'Gene Name': row['Gene Name'] || row['gene_name'] || row['gene'] || row['symbol'] || row['Symbol'] || Object.values(row)[0],
                            'Perturbation': scanGenesPerturbationType
                        }));
                        processGeneNames(processedRows, fileName);
                    }
                });
            } else if (file.name.endsWith('.xlsx')) {
                                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                rows = XLSX.utils.sheet_to_json(worksheet);
                // Always use the selected perturbation type from the dialog
                const processedRows = rows.map((row: any) => ({
                    'Gene Name': row['Gene Name'] || row['gene_name'] || row['gene'] || row['symbol'] || row['Symbol'] || Object.values(row)[0],
                    'Perturbation': scanGenesPerturbationType
                }));
                processGeneNames(processedRows, fileName);
            } else {
                toast.error("Unsupported file type. Please use .csv or .xlsx");
            }
        } catch (error) {
            console.error("Error parsing file:", error);
            toast.error("Error parsing file.");
        } finally {
            setLoading(false);
        }
    };

    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
  };

    const processGeneNames = async (rows: any[], folderName: string) => {
      if (rows.length === 0) {
        toast.info("No data found in the file.")
        return
      }

      // Set loading state
      setIsLibraryLoading(true)
      
      // Show loading state
      const toastId = toast.loading(`Scanning ${rows.length} genes...`, {
        description: 'Loading library…'
      });

      try {

    toast.info(`Found ${rows.length} entries. Fetching details...`);

    const newModules: Module[] = [];
    const failedGenes: string[] = [];
    const processedGenes = new Set<string>(); // Prevent duplicates
    
    for (const row of rows) {
        // More flexible gene name extraction
        let geneName = row['Gene Name'] || row['gene_name'] || row['gene'] || row['symbol'] || row['Symbol'] || Object.values(row)[0];
        const perturbationType = row['Perturbation'] || row['perturbation'] || row['Type'] || row['type'];

        if (!geneName) continue;
        
        // Clean up gene name (remove whitespace, convert to uppercase for consistency)
        geneName = String(geneName).trim().toUpperCase();
        
        // Skip if already processed
        if (processedGenes.has(geneName)) continue;
        processedGenes.add(geneName);

        const moduleType = (['overexpression', 'knockout', 'knockdown', 'knockin'].includes(perturbationType?.toLowerCase()) 
                            ? perturbationType.toLowerCase() 
                            : selectedType) as 'overexpression' | 'knockout' | 'knockdown' | 'knockin';
        
        let moduleAdded = false;
        
        try {
            const partialModule: Module = { 
                id: geneName, 
                name: geneName, 
                type: moduleType, 
                description: `Human gene ${geneName}`, 
                sequence: '' 
            };
            
            const enrichedModule = await enrichModuleWithSequence(partialModule);
            
            // Add module even if sequence enrichment partially failed
            if (enrichedModule) {
                newModules.push({
                    id: `${enrichedModule.name || geneName}-${moduleType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: enrichedModule.name || geneName,
                    type: moduleType,
                    description: enrichedModule.description || `Human gene ${enrichedModule.name || geneName}`,
                    sequence: enrichedModule.sequence || '', // Allow empty sequences
                    sequenceSource: enrichedModule.sequenceSource,
                });
                moduleAdded = true;
            }
        } catch (error) {
            console.error(`Error enriching gene ${geneName}:`, error);
        }
        
        // Fallback: Add gene even if enrichment completely failed
        if (!moduleAdded) {
            newModules.push({
                id: `${geneName}-${moduleType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: geneName,
                type: moduleType,
                description: `Human gene ${geneName} (sequence not found)`,
                sequence: '', // Empty sequence but gene is still added
            });
            failedGenes.push(geneName);
        }
    }

    // Always add modules; always create a dedicated library for this import, and also add to Total Library
    if (newModules.length > 0) {
      // Append modules using the provided setter (non-functional API)
      onCustomModulesChange([...customModules, ...newModules])

      const newModuleIds = newModules.map(m => m.id)

      {
        const updated = [...folders]
        // Ensure Total Library exists and append
        const totalIdx = updated.findIndex(f => f.id === 'total-library')
        if (totalIdx >= 0) {
          const total = { ...updated[totalIdx] }
          total.modules = [...total.modules, ...newModuleIds]
          updated[totalIdx] = total
        } else {
          updated.unshift({ id: 'total-library', name: 'Total Library', modules: [...newModuleIds], open: true })
        }

        // Always create a new library for this file/import
        const newFolder = {
          id: `folder-${Date.now()}`,
          name: folderName,
          modules: newModuleIds,
          open: true,
        }
        setFolders([...updated, newFolder])
      }
      
      // Update the loading toast with results
      const successfulGenes = newModules.length - failedGenes.length;
      if (failedGenes.length === 0) {
        toast.success(`Successfully added all ${newModules.length} genes to '${folderName}' library with sequences!`, { id: toastId });
      } else if (successfulGenes > 0) {
        toast.success(`Added ${newModules.length} genes to '${folderName}' library. ${successfulGenes} with sequences, ${failedGenes.length} without.`, { id: toastId });
      } else {
        toast.warning(
          `Added ${newModules.length} genes to '${folderName}' library, but no sequences were found.`, 
          { id: toastId }
        );
      }
      } else {
        toast.error('No valid genes could be processed. Please check your gene names and try again.');
      }
    } catch (error) {
      console.error('Error processing gene names:', error);
      toast.error('An error occurred while processing genes');
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // Close and reset the Import dialog
  const handleCloseImportDialog = () => {
    setShowScanGenesDialog(false)
    setGeneTextInput('')
    setScanGenesLibraryName('')
    setScanGenesPerturbationType('overexpression')
  }

  // Process genes from text input
  const handleProcessTextGenes = async () => {
    if (!geneTextInput.trim()) {
      toast.error('Please enter some gene names')
      return
    }
    
    if (!scanGenesLibraryName.trim()) {
      toast.error('Please enter a library name')
      return
    }
    
    // Parse gene names from text (split by newlines, commas, spaces, or tabs)
    const geneNames = geneTextInput
      .split(/[\n,\t\s]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0)
    
    if (geneNames.length === 0) {
      toast.error('No valid gene names found')
      return
    }
    
    // Convert to rows format expected by processGeneNames
    const rows = geneNames.map(geneName => ({
      'Gene Name': geneName,
      'Perturbation': scanGenesPerturbationType
    }))
    
    setShowScanGenesDialog(false)
    setGeneTextInput('')
    setScanGenesLibraryName('')
    setScanGenesPerturbationType('overexpression') // Reset to default
    
    await processGeneNames(rows, scanGenesLibraryName)
  }


  // Always show at least one folder
  React.useEffect(() => {
    // If folders change and selectedFolderId is missing, default to first
    if (folders.length > 0 && (!selectedFolderId || !folders.some(f => f.id === selectedFolderId))) {
      setSelectedFolderId(folders[0].id)
    }
  }, [folders, customModules.length])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Only use custom modules
  const filteredModules = customModules.filter(module =>
    module.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const isSelected = (moduleId: string) => 
    selectedModules.some(m => m.id === moduleId)

  // Export logic
  
  // Export: prompt for folder selection
  function handleExportLibrary() {
    if (folders.length === 0) return
    const folderName = window.prompt(
      'Export which folder?\n' + folders.map((f, i) => `${i + 1}: ${f.name}`).join('\n'),
      folders[0].name
    )
    if (!folderName) return
    const folder = folders.find(f => f.name === folderName) || folders[0]
    const modulesToExport = folder.modules.map(mid => customModules.find(m => m.id === mid)).filter(Boolean)
    const dataStr = JSON.stringify(modulesToExport, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${folder.name.replace(/\s+/g, '_').toLowerCase()}-library.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${modulesToExport.length} modules`)
  }

  // Helper to get arrow for module type
  function getTypeArrow(type: string) {
    switch (type) {
      case 'knockdown': return '↓';
      case 'knockout': return '✖';
      case 'knockin': return '→';
      case 'overexpression': return '↑';
      default: return '';
    }
  }

  return (
    <>
      {showSyntheticSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <SyntheticGeneSelector
            onGeneSelect={handleSyntheticGeneSelect}
            onCustomSequence={handleCustomSequence}
            onClose={() => setShowSyntheticSelector(false)}
          />
        </div>
      )}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">2. Select Modules</h2>
      
      {/* Unified Gene Search */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2 items-center">
          <span className="text-sm font-medium">Add to folder:</span>
          <select
            value={selectedFolderId || (folders[0] && folders[0].id) || ''}
            onChange={e => setSelectedFolderId(e.target.value)}
            className="h-9 px-2 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ minWidth: 120 }}
          >
            {folders.map((folder, index) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <UnifiedGeneSearch
            onModuleAdd={handleUnifiedModuleAdd}
            placeholder="Search or enter gene symbol..."
            showSelectedModules={false}
            showTypeButtons={false}
            defaultType={selectedType}
            className=""
            disabled={addingModule}
          />
          {addingModule && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-t-primary border-r-primary border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-2 items-center">
          {!hideTypeSelector && (
            <div className="relative">
              <select
                value={selectedType}
                onChange={e => {
                  const newType = e.target.value as any
                  setSelectedType(newType)
                  // If knockin is selected, immediately show synthetic gene selector
                  if (newType === 'knockin') {
                    setShowSyntheticSelector(true)
                  }
                }}
                className="h-9 px-2 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ minWidth: 70 }}
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Powered by Ensembl REST API
        </p>
      </div>
      {/* Divider */}
      <div className="border-t border-border my-4" />
      {/* Import/Export and Folder/Library creation below search */}
      <div className="flex gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => setShowScanGenesDialog(true)}>
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportLibrary}>
          Export
        </Button>
        <input
          type="file"
          accept=".csv,.xlsx"
          ref={geneFileInputRef}
          style={{ display: 'none' }}
          onChange={handleGeneFileChange}
        />
      </div>
      <div className="flex gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="New library name..."
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          className="border border-border rounded px-2 py-1 text-sm"
        />
      </div>
      {/* Folder/Library display */}
      <div className="mb-4 relative">
        {isLibraryLoading && (
          <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <Droppable droppableId="module-selector-folders" type="library" isDropDisabled={isLibraryLoading}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {folders.map((folder, index) => (
                <Draggable key={folder.id} draggableId={folder.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`mb-2 border rounded bg-muted transition-all ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="flex items-center cursor-pointer px-2 py-1 select-none"
                        onClick={() => handleToggleFolder(folder.id)}
                      >
                        <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${folder.open ? '' : '-rotate-90'}`} />
                        <div className="flex items-center gap-2">
                          {editingFolderId === folder.id ? (
                            <Input
                              type="text"
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              onBlur={handleSaveFolderName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFolderName();
                                if (e.key === 'Escape') setEditingFolderId(null);
                              }}
                              autoFocus
                              className="h-7"
                            />
                          ) : (
                            <span className="font-semibold">{folder.name}</span>
                          )}
                          <Badge variant="secondary">{folder.modules.length}</Badge>
                        </div>
                        <div className="flex-grow" />
                        {folder.id !== 'total-library' && (
                          <div className="flex items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleStartEditingFolder(folder.id, folder.name); }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleStartConversion(folder.id); }}
                              className="h-6 w-6 p-0"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setFolders(folders.filter(f => f.id !== folder.id)); }}
                              className="h-6 w-6 p-0 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {folder.open && !snapshot.isDragging && (
                        <Droppable droppableId={folder.id} type="module">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex flex-wrap gap-2 p-2 bg-background/50 min-h-[50px] transition-all ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`}
                            >
                              {customModules
                                .filter(m => folder.modules.includes(m.id))
                                .map((module, index) => (
                                  <Draggable key={module.id} draggableId={module.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`transition-all ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                      >
                                        <ModuleButton
                                          module={module}
                                          isSelected={selectedModules.some(m => m.id === module.id)}
                                          onClick={() => handleModuleClick(module)}
                                          onRemove={() => handleDeleteModule(module.id, folder.id)}
                                          showRemoveButton={true}
                                          enableContextMenu={true}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
      {/* Integrations (moved from top to avoid clutter near module selection) */}
      <div className="mt-4 p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Integrations</span>
          <div className="flex gap-2">
            <BenchlingButton
              isLinked={isBenchlingLinked}
              isLinking={isBenchlingLinking}
              onClick={handleBenchlingLink}
            />
            {isBenchlingLinked && (
              <>
                <Button variant="outline" size="sm" onClick={() => toast.info("Import from Benchling clicked (demo).")}>
                  Import
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast.info("Export to Benchling clicked (demo).")}>
                  Export
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      </Card>

      {/* Library Conversion Dialog */}
      {convertingFolderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Convert Library Type</h3>
            <p className="text-sm text-gray-600 mb-4">
              Convert all modules in "{folders.find(f => f.id === convertingFolderId)?.name}" to:
            </p>
            <div className="space-y-2 mb-6">
              {(['overexpression', 'knockout', 'knockdown', 'knockin', 'synthetic'] as const).map(type => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="conversionType"
                    value={type}
                    checked={conversionType === type}
                    onChange={(e) => setConversionType(e.target.value as any)}
                    className="text-blue-600"
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelConversion}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConversion}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Convert Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showScanGenesDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={handleCloseImportDialog}>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Import</h3>
            
            {/* Perturbation Type Selector - Moved to top */}
            <div className="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Perturbation Type</div>
              <div className="flex gap-2 flex-wrap">
                {typeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`flex-1 min-w-[100px] transition-all duration-200 font-medium ${
                      scanGenesPerturbationType === option.value 
                        ? option.className + ' shadow-md scale-[1.02]' 
                        : option.outlineClassName + ' hover:shadow-md hover:scale-[1.02]'
                    }`}
                    onClick={() => setScanGenesPerturbationType(option.value as any)}
                  >
                    <span className="drop-shadow-sm">{option.label}</span>
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                This will be applied to all genes being added
              </p>
            </div>
            
            <p className="text-base font-medium text-gray-800 dark:text-gray-200 mb-5">
              Choose how you'd like to add genes to your library:
            </p>
            
            <div className="space-y-6">
              {/* File Upload Option */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow duration-200">
                <h4 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">Upload File</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Upload a CSV or Excel file with gene names
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowScanGenesDialog(false)
                    geneFileInputRef.current?.click()
                  }}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File (CSV/Excel)
                </Button>
              </div>
              
              {/* Text Input Option */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow duration-200">
                <h4 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">Paste Gene Names</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Enter gene names separated by commas, spaces, or new lines
                </p>
                
                <div className="space-y-3">
                  <Input
                    placeholder="Library name (e.g., 'My Gene List')"
                    value={scanGenesLibraryName}
                    onChange={(e) => setScanGenesLibraryName(e.target.value)}
                    className="mb-3"
                  />
                  
                  <textarea
                    placeholder="Enter gene names here...\ne.g.: TP53, BRCA1, EGFR\nor one per line:
TP53
BRCA1
EGFR"
                    value={geneTextInput}
                    onChange={(e) => setGeneTextInput(e.target.value)}
                    className="w-full h-32 p-3 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                  />
                  
                  <Button 
                    onClick={handleProcessTextGenes}
                    disabled={!geneTextInput.trim() || !scanGenesLibraryName.trim()}
                    className="w-full"
                  >
                    Process Genes
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                onClick={handleCloseImportDialog}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}