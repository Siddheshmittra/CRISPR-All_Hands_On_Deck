import React, { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Plus, Trash2, ChevronDown, FolderPlus, X } from "lucide-react"
import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
}

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
      if (suggestions.length > 0) {
        // If we have suggestions, always use the first one
        selectSuggestion(suggestions[0])
        setTimeout(() => handleAddGene(), 0) // Small timeout to ensure state updates
      } else if (selectedSuggestion) { // If we already selected one
        handleAddGene() // Just add it
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

  // When adding a new module, place it in the selected folder or create a default folder if none exist
  function handleAddGene() {
    if (!selectedSuggestion) return
    // Prevent duplicates
    if (customModules.some(m => m.id === selectedSuggestion.symbol)) {
      setSearchTerm("")
      setSelectedSuggestion(null)
      return
    }

    const newModule = {
      id: selectedSuggestion.symbol,
      name: selectedSuggestion.symbol,
      type: selectedType as any,
      description: selectedSuggestion.name
    }

    // First add to customModules
    onCustomModulesChange([...customModules, newModule])

    // Then handle folder placement
    // Add to selected folder if one is selected (and it's not the Total Library)
    if (selectedFolderId && selectedFolderId !== 'total-library') {
      setFolders(folders.map(folder =>
        folder.id === selectedFolderId
          ? { ...folder, modules: [...folder.modules, newModule.id], open: true }
          : folder
      ))
    }

    // Clear the search
    setSearchTerm("")
    setSelectedSuggestion(null)
    setShowDropdown(false)
  }

  function handleDeleteModule(moduleId: string) {
    // Remove from customModules (parent will update folders and construct)
    onCustomModulesChange(customModules.filter(m => m.id !== moduleId))
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
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)
          onCustomModulesChange([...customModules, ...imported])
        } catch (error) {
          console.error('Failed to import library:', error)
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
        <Button variant="secondary" size="icon" onClick={handleAddGene} disabled={!selectedSuggestion}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Powered by NCBI GeneBank
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
                              </Badge>
                              {/* Show delete button only in Total Library */}
                              {folder.id === 'total-library' && (
                                <button
                                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-destructive absolute -top-2 -right-2"
                                  title="Remove from Total Library"
                                  onClick={e => { e.stopPropagation(); handleDeleteModule(module.id); }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
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