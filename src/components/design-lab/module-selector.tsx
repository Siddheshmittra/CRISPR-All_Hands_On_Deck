import React, { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Plus, Trash2, ChevronDown, FolderPlus, X, Loader2 } from "lucide-react"
import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { Module, EnsemblModule } from "@/lib/types"
import { BenchlingButton } from "@/components/ui/benchling-button"
import { SyntheticGeneSelector } from "./synthetic-gene-selector"
import { SyntheticGene } from "@/lib/types"

interface ModuleSelectorProps {
  selectedModules: Module[]
  onModuleSelect: (module: Module) => void
  onModuleDeselect: (moduleId: string) => void
  customModules: Module[]
  onCustomModulesChange: (modules: Module[]) => void
  folders: any[]
  setFolders: (folders: any[]) => void
  handleModuleClick: (module: Module) => void
}

export const ModuleSelector = ({ selectedModules, onModuleSelect, onModuleDeselect, customModules, onCustomModulesChange, folders, setFolders, handleModuleClick }: ModuleSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameCache = useRef<Map<string, string>>(new Map())
  let searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null)
  const [addingModule, setAddingModule] = useState(false)
  const [showSyntheticSelector, setShowSyntheticSelector] = useState(false)
  
  // Type selector state
  const [selectedType, setSelectedType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin'>('overexpression')
  const typeOptions = [
    { value: 'overexpression', label: 'OE' },
    { value: 'knockout', label: 'KO' },
    { value: 'knockdown', label: 'KD' },
    { value: 'knockin', label: 'KI' },
  ]

  const [newFolderName, setNewFolderName] = useState("")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
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

  const handleAddModule = async () => {
    if (!selectedSuggestion || addingModule) return
    
    setAddingModule(true)
    
    try {
      let moduleToAdd = selectedSuggestion
      
      // For knockin modules, show synthetic gene selector
      if (selectedType === 'knockin') {
        setShowSyntheticSelector(true)
        setAddingModule(false)
        return
      }
      
      // For other module types, proceed as normal
      if (moduleToAdd.sequence) {
        const newModule: Module = {
          id: `${moduleToAdd.symbol}-${Date.now()}`,
          name: moduleToAdd.symbol,
          type: selectedType,
          description: moduleToAdd.description || `Human gene ${moduleToAdd.symbol}`,
          sequence: moduleToAdd.sequence
        }
        
        onCustomModulesChange([...customModules, newModule])
        setSelectedSuggestion(null)
        setSearchTerm("")
        setSuggestions([])
        toast.success(`Added ${moduleToAdd.symbol} to library`)
      } else {
        toast.error("No sequence available for this gene")
      }
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error("Failed to add module")
    } finally {
      setAddingModule(false)
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

  // Import/export logic
  const fileInputRef = useRef<HTMLInputElement>(null)
  function handleImportLibrary() {
    if (fileInputRef.current) fileInputRef.current.click()
  }
  
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)
          // If modules don't have sequences, try to enrich them
          const enrichedModules = await Promise.all(
            imported.map(async (module: Module) => {
              if (!module.sequence) {
                try {
                  return await enrichModuleWithSequence(module)
                } catch (error) {
                  console.error(`Failed to enrich ${module.name}:`, error)
                  return module
                }
              }
              return module
            })
          )
          onCustomModulesChange([...customModules, ...enrichedModules])
          toast.success(`Imported ${enrichedModules.length} modules`)
        } catch (error) {
          console.error('Failed to import library:', error)
          toast.error('Failed to import library')
        }
      }
      reader.readAsText(file)
    }
  }
  
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
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">2. Select Modules</h2>
      
      {showSyntheticSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <SyntheticGeneSelector
            onGeneSelect={handleSyntheticGeneSelect}
            onCustomSequence={handleCustomSequence}
            onClose={() => setShowSyntheticSelector(false)}
          />
        </div>
      )}
      
      {/* Type selector + search + add button row */}
      <div className="flex gap-2 mb-4 items-center">
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value as any)}
          className="h-9 px-2 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ minWidth: 70 }}
        >
          {typeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="gene-search-input"
            ref={inputRef}
            placeholder="Search or enter gene symbol..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
              setSelectedSuggestion(null)
            }}
            onKeyDown={handleKeyDown}
            className="pl-10"
            autoComplete="off"
          />
          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded shadow-elevated max-h-60 overflow-auto"
            >
              {suggestions.map((s, idx) => (
                <div
                  key={s.symbol}
                  className={`px-3 py-2 cursor-pointer hover:bg-muted ${idx === selectedIndex ? 'bg-muted font-semibold' : ''}`}
                  onMouseDown={() => selectSuggestion(s)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="font-bold">{s.symbol}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.hgnc_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <select
          value={selectedFolderId || (folders[0] && folders[0].id) || ''}
          onChange={e => setSelectedFolderId(e.target.value)}
          className="h-9 px-2 rounded-md border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ minWidth: 120 }}
        >
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={handleAddModule} 
          disabled={!selectedSuggestion || addingModule}
        >
          {addingModule ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Powered by Ensembl REST API
      </p>
      {/* Divider */}
      <div className="border-t border-border my-4" />
      {/* Import/Export and Folder/Library creation below search */}
      <div className="flex gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={handleImportLibrary}>
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportLibrary}>
          Export
        </Button>
        <BenchlingButton
          isLinked={isBenchlingLinked}
          isLinking={isBenchlingLinking}
          onClick={handleBenchlingLink}
        />
        {isBenchlingLinked && (
          <>
            <Button variant="outline" size="sm" onClick={() => toast.info("Import from Benchling clicked (demo).")}>
              Import from Benchling
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Export to Benchling clicked (demo).")}>
              Export to Benchling
            </Button>
          </>
        )}
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
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
        <Button variant="outline" size="sm" onClick={handleCreateFolder}>
          <FolderPlus className="h-4 w-4 mr-1" />Create Library
        </Button>
      </div>
      {/* Folder/Library display */}
      <div className="mb-4">
        {folders.map(folder => (
          <div key={folder.id} className="mb-2 border rounded bg-muted">
            <div
              className="flex items-center cursor-pointer px-2 py-1 select-none"
              onClick={() => handleToggleFolder(folder.id)}
            >
              <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${folder.open ? '' : '-rotate-90'}`} />
              <span className="font-semibold text-sm">{folder.name}</span>
            </div>
            {folder.open && (
              <Droppable droppableId={folder.id} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="pl-6 pb-2 pt-1 flex flex-wrap gap-2 min-h-[32px]"
                  >
                    {folder.modules.length === 0 && <span className="text-xs text-muted-foreground">No modules</span>}
                    {folder.modules.map((mid, idx) => {
                      const module = customModules.find(m => m.id === mid)
                      if (!module) return null
                      return (
                        <Draggable key={module.id} draggableId={module.id} index={idx}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`cursor-move transition-transform ${dragSnapshot.isDragging ? 'scale-105 rotate-2 z-50' : 'hover:scale-105'} relative flex items-center`}
                            >
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${isSelected(module.id) ? 'bg-primary text-primary-foreground' : ''} ${dragSnapshot.isDragging ? 'shadow-lg' : ''}`}
                                  onClick={() => handleModuleClick(module)}
                                >
                                  {getTypeArrow(module.type)} {module.name}
                                  {module.sequence ? ` (${module.sequence.length}bp)` : ''}
                                </Badge>
                              {/* Show delete button in all folders */}
                              <button
                                className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-destructive absolute -top-2 -right-2"
                                title={folder.id === 'total-library' ? "Remove from Total Library" : "Remove from this Library"}
                                onClick={e => { e.stopPropagation(); handleDeleteModule(module.id, folder.id); }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}