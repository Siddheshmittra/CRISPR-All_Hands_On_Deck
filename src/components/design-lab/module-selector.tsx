import React, { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Plus, Trash2, ChevronDown, FolderPlus } from "lucide-react"
import { Droppable, Draggable, DragDropContext } from "@hello-pangea/dnd"
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
  onCustomModulesChange: (modules: Module[]) => void // <-- add this prop
}

export const ModuleSelector = ({ selectedModules, onModuleSelect, onModuleDeselect, customModules, onCustomModulesChange }: ModuleSelectorProps) => {
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

  // Folder/Library demo state
  const [folders, setFolders] = useState<any[]>([])
  const [newFolderName, setNewFolderName] = useState("")

  // Compute modules not in any folder
  const folderedModuleIds = folders.flatMap(f => f.modules)
  const unassignedModules = customModules.filter(m => !folderedModuleIds.includes(m.id))

  function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setFolders(folders => [
      ...folders,
      { id: Date.now() + '-' + Math.random(), name: newFolderName.trim(), modules: [], open: true }
    ])
    setNewFolderName("")
  }
  function handleToggleFolder(id: string) {
    setFolders(folders => folders.map(f => f.id === id ? { ...f, open: !f.open } : f))
  }
  function handleDropModuleToFolder(moduleId: string, folderId: string) {
    setFolders(folders => folders.map(f => {
      if (f.id === folderId) {
        return { ...f, modules: [...new Set([...f.modules, moduleId])] }
      } else {
        return { ...f, modules: f.modules.filter(mid => mid !== moduleId) }
      }
    }))
  }

  // Handle drag end for folders
  function handleDragEnd(result: any) {
    if (!result.destination) return
    const moduleId = result.draggableId.split('-')[0]
    const destFolderId = result.destination.droppableId
    setFolders(folders => folders.map(f => {
      if (f.id === destFolderId) {
        return { ...f, modules: [...new Set([...f.modules, moduleId])] }
      } else {
        return { ...f, modules: f.modules.filter(mid => mid !== moduleId) }
      }
    }))
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
    searchTimeout.current = setTimeout(async () => {
      const items = await hgncSuggest(searchTerm)
      setSuggestions(items)
      setShowDropdown(true)
      setLoading(false)
      setSelectedIndex(-1)
    }, 300)
    // eslint-disable-next-line
  }, [searchTerm])

  // Keyboard navigation for dropdown
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || !suggestions.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(idx => (idx + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(idx => (idx - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        selectSuggestion(suggestions[selectedIndex])
        // Add gene immediately after selecting
        setTimeout(() => handleAddGene(), 0)
      } else if (selectedSuggestion) {
        handleAddGene()
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  function selectSuggestion(suggestion: any) {
    setSearchTerm(suggestion.symbol)
    setShowDropdown(false)
    setSuggestions([])
    setSelectedSuggestion(suggestion)
  }

  function handleAddGene() {
    if (!selectedSuggestion) return
    // Prevent duplicates
    if (customModules.some(m => m.id === selectedSuggestion.symbol)) return
    const newModule = {
      id: selectedSuggestion.symbol,
      name: selectedSuggestion.symbol,
      type: selectedType as any,
      description: selectedSuggestion.name
    }
    onCustomModulesChange([...customModules, newModule])
    setSearchTerm("")
    setSelectedSuggestion(null)
  }

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

  const handleModuleClick = (module: Module) => {
    if (isSelected(module.id)) {
      onModuleDeselect(module.id)
    } else {
      onModuleSelect(module)
    }
  }

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
  function handleExportLibrary() {
    const dataStr = JSON.stringify(customModules, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gene-library.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Remove isSelected logic from Draggable rendering, so all modules are always draggable
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
      {/* Folder/Library toggles demo */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="mb-4">
          {folders.map(folder => (
            <Droppable droppableId={folder.id} key={folder.id} direction="horizontal">
              {(provided) => (
                <div className="mb-2 border rounded bg-muted">
                  <div
                    className="flex items-center cursor-pointer px-2 py-1 select-none"
                    onClick={() => handleToggleFolder(folder.id)}
                  >
                    <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${folder.open ? '' : '-rotate-90'}`} />
                    <span className="font-semibold text-sm">{folder.name}</span>
                  </div>
                  {folder.open && (
                    <div className="pl-6 pb-2 pt-1 flex flex-wrap gap-2"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {folder.modules.length === 0 && <span className="text-xs text-muted-foreground">No modules</span>}
                      {folder.modules.map((mid, idx) => {
                        const module = customModules.find(m => m.id === mid)
                        if (!module) return null
                        return (
                          <Draggable key={module.id + '-folder'} draggableId={module.id + '-folder'} index={idx}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="cursor-move"
                              >
                                <Badge variant="secondary" className="text-xs">
                                  {module.name}
                                </Badge>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </Card>
  )
}