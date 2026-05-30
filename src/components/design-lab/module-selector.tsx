import React, { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModuleButton } from "@/components/ui/module-button"
import { Search, Upload, Plus, Trash2, Edit3, Check, X, RefreshCw, FolderPlus, ChevronDown, Loader2, AlertTriangle, Info } from "lucide-react"
import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { enrichModuleWithSequence } from "@/lib/ensembl"
import { Module, EnsemblModule } from "@/lib/types"
// Benchling integration removed
import { SyntheticGeneSelector } from "./synthetic-gene-selector"
import { syntheticGeneModuleType } from "@/lib/synthetic-genes"
import { buildCactusLibrariesAsync } from "@/lib/cactus"
import { SyntheticGene } from "@/lib/types"
import { UnifiedGeneSearch } from "./unified-gene-search"
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { TypedHeading } from '@/components/ui/typed-heading'

type ImportIssue = {
  gene: string
  reason: string
  severity: 'warning' | 'error'
  row?: number
}

interface ImportReport {
  folderName: string
  totalRows: number
  parsedGenes: number
  addedModules: number
  withSequences: number
  placeholders: number
  durationMs: number
  issues: ImportIssue[]
  errorCount: number
  warningCount: number
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
  
  // Type selector state (styled to match single-cassette manual DGP)
  const [selectedType, setSelectedType] = useState<'overexpression' | 'knockout' | 'knockdown' | 'knockin'>('overexpression')
  const typeOptions = [
    { 
      value: 'overexpression', 
      label: 'OE',
      icon: '↑',
      className: 'bg-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,40%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(66,70%,47%)] border-[hsl(66,70%,47%)] hover:bg-[hsl(66,70%,47%)]/20 hover:text-[hsl(66,70%,47%)] font-medium'
    },
    { 
      value: 'knockout', 
      label: 'KO',
      icon: '✖',
      className: 'bg-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,50%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(13,95%,59%)] border-[hsl(13,95%,59%)] hover:bg-[hsl(13,95%,59%)]/20 hover:text-[hsl(13,95%,59%)] font-medium'
    },
    { 
      value: 'knockdown', 
      label: 'KD',
      icon: '↓',
      className: 'bg-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,40%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(32,75%,49%)] border-[hsl(32,75%,49%)] hover:bg-[hsl(32,75%,49%)]/20 hover:text-[hsl(32,75%,49%)] font-medium'
    },
    { 
      value: 'knockin', 
      label: 'KI*',
      icon: '→',
      className: 'bg-[hsl(201,62%,65%)] hover:bg-[hsl(201,62%,55%)] text-white font-semibold',
      outlineClassName: 'text-[hsl(201,62%,65%)] border-[hsl(201,62%,65%)] hover:bg-[hsl(201,62%,65%)]/20 hover:text-[hsl(201,62%,65%)] font-medium'
    },
  ]

  const [newFolderName, setNewFolderName] = useState("")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const CONSTANTS_FOLDER_ID = 'constants-library'
  // Benchling integration removed

  // Compute modules not in any folder
  const folderedModuleIds = folders.flatMap(f => f.modules)
  const unassignedModules = customModules.filter(m => !folderedModuleIds.includes(m.id))

  function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const newId = Date.now() + '-' + Math.random()
    setFolders([
      ...folders,
      { id: newId, name: newFolderName.trim(), modules: [], open: false }
    ])
    setNewFolderName("")
    setActiveFolderId(newId)
    setSelectedFolderId(newId)
  }
  
  function handleToggleFolder(id: string) {
    setFolders(folders.map(f => f.id === id ? { ...f, open: !f.open } : f))
    setActiveFolderId(id)
  }

  const getSelectedTypeColorClass = (type: 'overexpression' | 'knockout' | 'knockdown' | 'knockin') => {
    switch (type) {
      case 'overexpression':
        return 'bg-[hsl(66,70%,47%)] text-white border-transparent';
      case 'knockout':
        return 'bg-[hsl(13,95%,59%)] text-white border-transparent';
      case 'knockdown':
        return 'bg-[hsl(32,75%,49%)] text-white border-transparent';
      case 'knockin':
        return 'bg-[hsl(201,62%,65%)] text-foreground border-transparent';
      default:
        return '';
    }
  }

  // Benchling link handler removed
  
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
  const addModuleToSelectedFolder = (moduleId: string, forcedFolderId?: string | null) => {
    const targetFolderId = forcedFolderId ?? selectedFolderId;
    if (!targetFolderId || targetFolderId === 'total-library') return;

    setFolders(prevFolders =>
      prevFolders.map(folder => {
        if (folder.id !== targetFolderId) return folder;
        if (folder.modules.includes(moduleId)) return folder;
        return { ...folder, modules: [...folder.modules, moduleId] };
      })
    );
  };

  const removeModuleFromFolder = (moduleId: string, forcedFolderId?: string | null) => {
    const targetFolderId = forcedFolderId ?? selectedFolderId;
    if (!targetFolderId || targetFolderId === 'total-library') return;

    setFolders(prevFolders =>
      prevFolders.map(folder => {
        if (folder.id !== targetFolderId) return folder;
        if (!folder.modules.includes(moduleId)) return folder;
        return { ...folder, modules: folder.modules.filter(id => id !== moduleId) };
      })
    );
  };

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
      addModuleToSelectedFolder(module.id)
      toast.success(`Added ${module.name} to library`)
    } catch (error) {
      console.error("Error adding module:", error)
      toast.error("Failed to add module")
    }
  }

  const handleAddModule = async () => {
    if (!selectedSuggestion || addingModule) return
    
    const geneId = selectedSuggestion.symbol
    const targetFolderId = selectedFolderId
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

      // Add the module immediately with loading state (for optimistic UI updates)
      const nextCustomModules = [...customModules, newModule]
      onCustomModulesChange(nextCustomModules)
      addModuleToSelectedFolder(newModule.id, targetFolderId)

      // Enrich the module in the background
      try {
        const enforceTypeSource = selectedType === 'knockdown' || selectedType === 'knockout'
        const enrichedModule = await enrichModuleWithSequence(newModule, enforceTypeSource ? { enforceTypeSource: true } : undefined)

        const updatedModules = nextCustomModules.map(m =>
          m.id === newModule.id ? { ...enrichedModule, isEnriching: false } : m
        )
        onCustomModulesChange(updatedModules)

        toast.success(`Added ${moduleToAdd.symbol} to library`)
      } catch (error) {
        console.error(`Failed to enrich ${moduleToAdd.symbol}:`, error)

        // Remove the optimistic module and warn the user when type-specific sequence is unavailable
        const cleanedModules = nextCustomModules.filter(m => m.id !== newModule.id)
        onCustomModulesChange(cleanedModules)
        removeModuleFromFolder(newModule.id, targetFolderId)

        const baseMessage = error instanceof Error ? error.message : 'Sequence enrichment failed'
        const normalized = baseMessage.toLowerCase()
        const shouldWarn = normalized.includes('not available') || normalized.includes('sequence not found') || normalized.includes('shrna') || normalized.includes('grna')
        const typeLabel = selectedType.toUpperCase()
        const notify = shouldWarn ? toast.warning : toast.error
        notify(`Couldn't add ${moduleToAdd.symbol} as ${typeLabel}: ${baseMessage}`)
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
      type: syntheticGeneModuleType(gene),
      description: gene.description,
      sequence: gene.sequence,
      isSynthetic: true,
      syntheticSequence: gene.sequence
    }
    
    onCustomModulesChange([...customModules, newModule])
    addModuleToSelectedFolder(newModule.id)
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
    addModuleToSelectedFolder(newModule.id)
    setShowSyntheticSelector(false)
    setSelectedSuggestion(null)
    setSearchTerm("")
    setSuggestions([])
    toast.success("Added custom synthetic gene to library")
  }

  // Heuristics to robustly detect and extract gene symbols from tabular data
  const normalizeHeader = (h: string) => (h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const geneHeaderCandidates = new Set([
    'gene',
    'genes',
    'gene name',
    'gene_name',
    'gene symbol',
    'genesymbol',
    'symbol',
    'symbols',
    'hgnc',
    'hgnc symbol',
    'approved symbol',
    'approved_symbol',
    'target',
    'target gene',
  ])
  const synonymsHeaderCandidates = new Set([
    'synonym',
    'synonyms',
    'alias',
    'aliases',
  ])
  const perturbationTokenSet = new Set([
    'OVEREXPRESSION',
    'OVER-EXPRESSION',
    'OVER EXPRESSION',
    'UPREGULATION',
    'UP-REGULATION',
    'DOWNREGULATION',
    'DOWN-REGULATION',
    'KNOCKOUT',
    'KNOCK-OUT',
    'KNOCK DOWN',
    'KNOCKDOWN',
    'KNOCKIN',
    'KNOCK-IN',
    'KO',
    'KD',
    'KI',
    'OE',
    'PERTURBATION',
    'PERTURBATIONS',
    'TYPE',
    'TYPES',
    'CONTROL',
    'NEGATIVE CONTROL',
    'POSITIVE CONTROL',
    'UNTREATED',
    'VEHICLE',
    'NONE',
    'N/A',
    'NA',
    'SYNTHETIC',
    'REFERENCE',
    'REFERENCE GENE'
  ])
  const isPerturbationToken = (raw: unknown): boolean => {
    if (raw == null) return false
    const upper = String(raw).trim().toUpperCase()
    if (!upper) return false
    if (perturbationTokenSet.has(upper)) return true
    if (upper.includes('PERTURBATION')) return true
    if (upper.includes('CONTROL') && upper.length <= 20) return true
    if (/KNOCK[\s-]?(OUT|DOWN|IN)/.test(upper)) return true
    if (/OVER[\s-]?EXPRESS/.test(upper)) return true
    if (/UP[\s-]?REGUL/.test(upper) || /DOWN[\s-]?REGUL/.test(upper)) return true
    return false
  }
  const isNumericLike = (v: any) => typeof v === 'number' || (/^\s*\d+\s*$/.test(String(v || '')))
  const isGeneLikeToken = (raw: string) => {
    const s = (raw || '').trim().toUpperCase()
    if (!s) return false
    // Allow longer gene names (some gene symbols can be longer)
    if (s.length > 30) return false
    // Reject pure numbers
    if (/^\d+$/.test(s)) return false
    if (isPerturbationToken(s)) return false
    // Allow alphanumeric with hyphens, underscores, and dots (common in gene nomenclature)
    if (!/^[A-Z0-9][A-Z0-9\-_.]*[A-Z0-9]$/.test(s) && !/^[A-Z0-9]$/.test(s)) return false
    // Require at least one letter (genes must have letters, not just numbers)
    if (!/[A-Z]/.test(s)) return false
    // Minimum length of 2 characters (or 1 if it's a letter)
    if (s.length < 1) return false
    return true
  }
  const pickFirstGeneLikeFromCell = (cell: any): string | null => {
    if (cell == null) return null
    const str = String(cell)
    const parts = str.split(/[;,\|\/\t\n\r\s]+/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      if (isGeneLikeToken(p)) return p.toUpperCase()
    }
    return null
  }
  const nonGeneHeaderTokens = new Set([
    'perturbation',
    'perturbations',
    'type',
    'types',
    'category',
    'categories',
    'class',
    'classes',
    'phenotype',
    'phenotypes',
    'notes',
    'note',
    'description',
    'descriptions',
    'library',
    'folder',
    'folders',
    'module',
    'modules',
    'group',
    'groups',
    'condition',
    'conditions',
    'control',
    'controls',
    'status'
  ])
  const detectGeneColumn = (headers: string[], sampleRows: any[]): string | null => {
    if (!headers || headers.length === 0) return null
    const normalized = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }))
    const headerScore = new Map<string, number>()
    for (const h of normalized) {
      let score = 0
      if (nonGeneHeaderTokens.has(h.norm)) {
        headerScore.set(h.raw, -5)
        continue
      }
      if (geneHeaderCandidates.has(h.norm)) score += 3
      if (h.norm.includes('gene') && h.norm.includes('symbol')) score += 3
      if (h.norm === 'symbol') score += 2
      if (h.norm.includes('gene')) score += 1
      headerScore.set(h.raw, score)
    }
    const sample = sampleRows.slice(0, 50)
    const contentScore = new Map<string, number>()
    for (const h of headers) {
      let hits = 0
      let nonEmpty = 0
      for (const row of sample) {
        const v = (row && (row as any)[h])
        if (v == null || String(v).trim() === '') continue
        nonEmpty++
        const token = pickFirstGeneLikeFromCell(v)
        if (token) hits++
      }
      const norm = normalizeHeader(h)
      if (nonGeneHeaderTokens.has(norm)) {
        contentScore.set(h, -1)
        continue
      }
      const frac = nonEmpty > 0 ? hits / nonEmpty : 0
      let numericCount = 0
      for (const row of sample) {
        const v = (row && (row as any)[h])
        if (isNumericLike(v)) numericCount++
      }
      const numericFrac = sample.length > 0 ? numericCount / sample.length : 0
      const score = Math.max(0, frac - numericFrac)
      contentScore.set(h, score)
    }
    let best: { h: string; total: number } | null = null
    for (const h of headers) {
      const total = (headerScore.get(h) || 0) * 2 + (contentScore.get(h) || 0)
      if (!best || total > best.total) best = { h, total }
    }
    if (best && best.total > 0.5) return best.h
    return null
  }
  const extractGeneNameFromRow = (row: any, headers: string[]): string => {
    if (!row || typeof row !== 'object') return '';
    
    // Strategy 1: Try detecting the gene column from headers
    const geneCol = detectGeneColumn(headers, [row]) || null
    if (geneCol && row[geneCol]) {
      const tok = pickFirstGeneLikeFromCell(row[geneCol])
      if (tok && !isPerturbationToken(tok)) {
        console.log('[Extract] Found gene via detected column:', tok, 'from column:', geneCol);
        return tok;
      }
    }
    
    // Strategy 2: Try common gene column names (case-insensitive)
    const commonGeneHeaders = ['gene', 'gene name', 'gene_name', 'symbol', 'gene symbol', 'hgnc', 'target'];
    for (const h of headers) {
      const normH = normalizeHeader(h);
      if (commonGeneHeaders.some(common => normH === common || normH.includes(common))) {
        const tok = pickFirstGeneLikeFromCell(row[h]);
        if (tok && !isPerturbationToken(tok)) {
          console.log('[Extract] Found gene via common header:', tok, 'from column:', h);
          return tok;
        }
      }
    }
    
    // Strategy 3: Try synonym columns
    for (const h of headers) {
      const norm = normalizeHeader(h)
      if (synonymsHeaderCandidates.has(norm)) {
        const tok = pickFirstGeneLikeFromCell(row[h])
        if (tok && !isPerturbationToken(tok)) {
          console.log('[Extract] Found gene via synonym column:', tok, 'from column:', h);
          return tok;
        }
      }
    }
    
    // Strategy 4: Try first column if it looks promising
    if (headers.length > 0 && headers[0] && row[headers[0]]) {
      const tok = pickFirstGeneLikeFromCell(row[headers[0]]);
      if (tok && !isPerturbationToken(tok)) {
        console.log('[Extract] Found gene via first column:', tok, 'from column:', headers[0]);
        return tok;
      }
    }
    
    // Strategy 5: Scan all columns as last resort
    for (const h of headers) {
      if (row[h]) {
        const tok = pickFirstGeneLikeFromCell(row[h])
        if (tok && !isPerturbationToken(tok)) {
          console.log('[Extract] Found gene via column scan:', tok, 'from column:', h);
          return tok;
        }
      }
    }
    
    console.log('[Extract] No valid gene found in row:', row);
    return ''
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

    const fileName = file.name.replace(/\.(csv|xlsx)$/i, '');
    
    setLoading(true);
    setIsLibraryLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = e.target?.result;
        if (typeof data !== 'string' && !(data instanceof ArrayBuffer)) {
            toast.error("Failed to read file.");
            setLoading(false);
            setIsLibraryLoading(false);
            return;
        }

        try {
            let rows: any[] = [];
            if (file.name.toLowerCase().endsWith('.csv')) {
              Papa.parse(data as string, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                complete: (results) => {
                  console.log('[Import] CSV parsed:', results.data.length, 'rows');
                  const arr = (results.data as any[]) || []
                  if (arr.length === 0) {
                    toast.error('No data found in CSV file');
                    setLoading(false);
                    setIsLibraryLoading(false);
                    return;
                  }
                  const headers = arr.length > 0 ? Object.keys(arr[0] || {}) : []
                  console.log('[Import] Headers detected:', headers);
                  
                  const parseErrors: string[] = [];
                  const processedRows = arr.map((row: any, index: number) => {
                    const geneName = extractGeneNameFromRow(row, headers);
                    console.log('[Import] Row', index + 1, '- Extracted gene:', geneName, 'from row:', row);
                    
                    if (!geneName || !geneName.trim()) {
                      parseErrors.push(`Row ${index + 1}: Could not extract valid gene name`);
                      return null;
                    }
                    
                    return {
                      'Gene Name': geneName.trim().toUpperCase(),
                      'Perturbation': scanGenesPerturbationType as 'overexpression' | 'knockout' | 'knockdown' | 'knockin',
                    }
                  }).filter((row): row is { 'Gene Name': string; 'Perturbation': 'overexpression' | 'knockout' | 'knockdown' | 'knockin' } => 
                    row !== null && !!row['Gene Name'] && row['Gene Name'].length > 0
                  );
                  
                  console.log('[Import] Successfully processed rows:', processedRows.length);
                  console.log('[Import] Parse errors:', parseErrors.length);
                  
                  if (processedRows.length === 0) {
                    toast.error(`No valid gene names found in CSV. Check that your file has a column with gene symbols.`);
                    setLoading(false);
                    setIsLibraryLoading(false);
                    return;
                  }
                  
                  if (parseErrors.length > 0 && parseErrors.length < arr.length) {
                    toast.warning(`Processed ${processedRows.length} genes, skipped ${parseErrors.length} rows with invalid/missing gene names`);
                  } else {
                    toast.info(`Found ${processedRows.length} gene names. Processing...`);
                  }
                  
                  processGeneNames(processedRows, fileName)
                },
                error: (error) => {
                  console.error('[Import] CSV parse error:', error);
                  toast.error('Failed to parse CSV file');
                  setLoading(false);
                  setIsLibraryLoading(false);
                }
              })
            } else if (file.name.toLowerCase().endsWith('.xlsx')) {
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
              console.log('[Import] XLSX parsed:', rows.length, 'rows');
              if (rows.length === 0) {
                toast.error('No data found in Excel file');
                setLoading(false);
                setIsLibraryLoading(false);
                return;
              }
              const headers = rows.length > 0 ? Object.keys(rows[0] || {}) : []
              console.log('[Import] Headers detected:', headers);
              
              const parseErrors: string[] = [];
              const processedRows = rows.map((row: any, index: number) => {
                const geneName = extractGeneNameFromRow(row, headers);
                console.log('[Import] Row', index + 1, '- Extracted gene:', geneName, 'from row:', row);
                
                if (!geneName || !geneName.trim()) {
                  parseErrors.push(`Row ${index + 1}: Could not extract valid gene name`);
                  return null;
                }
                
                return {
                  'Gene Name': geneName.trim().toUpperCase(),
                  'Perturbation': scanGenesPerturbationType as 'overexpression' | 'knockout' | 'knockdown' | 'knockin',
                }
              }).filter((row): row is { 'Gene Name': string; 'Perturbation': 'overexpression' | 'knockout' | 'knockdown' | 'knockin' } => 
                row !== null && !!row['Gene Name'] && row['Gene Name'].length > 0
              );
              
              console.log('[Import] Successfully processed rows:', processedRows.length);
              console.log('[Import] Parse errors:', parseErrors.length);
              
              if (processedRows.length === 0) {
                toast.error(`No valid gene names found in Excel file. Check that your file has a column with gene symbols.`);
                setLoading(false);
                setIsLibraryLoading(false);
                return;
              }
              
              if (parseErrors.length > 0 && parseErrors.length < rows.length) {
                toast.warning(`Processed ${processedRows.length} genes, skipped ${parseErrors.length} rows with invalid/missing gene names`);
              } else {
                toast.info(`Found ${processedRows.length} gene names. Processing...`);
              }
              
              processGeneNames(processedRows, fileName)
            } else {
                toast.error("Unsupported file type. Please use .csv or .xlsx");
                setLoading(false);
                setIsLibraryLoading(false);
            }
        } catch (error) {
            console.error("Error parsing file:", error);
            toast.error(`Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setLoading(false);
            setIsLibraryLoading(false);
        }
    };

    reader.onerror = () => {
      console.error('[Import] File read error');
      toast.error('Failed to read file');
      setLoading(false);
      setIsLibraryLoading(false);
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
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

      setImportReport(null)

      setIsLibraryLoading(true)

      const toastId = toast.loading(`Scanning ${rows.length} genes...`, {
        description: 'Loading library...'
      });

      const startedAt = Date.now()

      try {
        const issues: ImportIssue[] = []
        const processedGenes = new Set<string>()
        const pendingGenes: Array<{ geneName: string; moduleType: 'overexpression' | 'knockout' | 'knockdown' | 'knockin'; row: number; order: number }> = []

        rows.forEach((row, index) => {
          // More flexible gene name extraction
          let geneName = row['Gene Name'] || row['gene_name'] || row['gene'] || row['symbol'] || row['Symbol'] || ''
          if (!geneName) {
            const headers = Object.keys(row || {})
            for (const h of headers) {
              const tok = pickFirstGeneLikeFromCell(row[h])
              if (tok) { geneName = tok; break }
            }
          }

          const rowNumber = index + 1
          const perturbationType = row['Perturbation'] || row['perturbation'] || row['Type'] || row['type']

          if (!geneName || !geneName.trim()) {
            console.warn('[ProcessGenes] Skipping row with empty gene name:', row)
            issues.push({ gene: `Row ${rowNumber}`, reason: 'No valid gene symbol detected', severity: 'error', row: rowNumber })
            return
          }

          geneName = String(geneName).trim().toUpperCase()

          if (geneName.length < 2 || /^\d+$/.test(geneName)) {
            console.warn('[ProcessGenes] Skipping invalid gene name:', geneName)
            issues.push({ gene: geneName, reason: 'Invalid gene symbol format', severity: 'error', row: rowNumber })
            return
          }

          if (isPerturbationToken(geneName)) {
            console.warn('[ProcessGenes] Skipping perturbation keyword masquerading as gene:', geneName)
            issues.push({ gene: geneName, reason: 'Looks like a perturbation label, not a gene', severity: 'error', row: rowNumber })
            return
          }

          if (processedGenes.has(geneName)) {
            console.log('[ProcessGenes] Skipping duplicate gene:', geneName)
            issues.push({ gene: geneName, reason: `Duplicate entry skipped (row ${rowNumber})`, severity: 'warning', row: rowNumber })
            return
          }
          processedGenes.add(geneName)

          const moduleType = (['overexpression', 'knockout', 'knockdown', 'knockin'].includes(perturbationType?.toLowerCase())
            ? perturbationType.toLowerCase()
            : selectedType) as 'overexpression' | 'knockout' | 'knockdown' | 'knockin'

          pendingGenes.push({ geneName, moduleType, row: rowNumber, order: index })
        })

        if (pendingGenes.length === 0) {
          toast.error('No valid gene names found. Please check your input.', { id: toastId, duration: 6000 })
          setImportReport({
            folderName,
            totalRows: rows.length,
            parsedGenes: 0,
            addedModules: 0,
            withSequences: 0,
            placeholders: 0,
            durationMs: Date.now() - startedAt,
            issues,
            errorCount: issues.filter(i => i.severity === 'error').length,
            warningCount: issues.filter(i => i.severity === 'warning').length
          })
          return
        }

        const moduleResults: Array<{ module: Module; order: number }> = []
        let withSequences = 0
        let placeholders = 0

        const queue = [...pendingGenes]
        const concurrency = Math.min(6, Math.max(1, queue.length))

        const processEntry = async ({ geneName, moduleType, row, order }: typeof pendingGenes[number]) => {
          const moduleId = `${geneName}-${moduleType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const baseModule: Module = {
            id: moduleId,
            name: geneName,
            type: moduleType,
            description: `Human gene ${geneName}`,
            sequence: ''
          }

          try {
            const enrichedModule = await enrichModuleWithSequence(baseModule, { enforceTypeSource: true })
            const finalName = enrichedModule.name?.trim() || geneName
            if (!finalName || finalName.length < 2) {
              console.warn('[ProcessGenes] Enriched module has invalid name:', finalName)
              issues.push({ gene: geneName, reason: 'Sequence fetched but returned an invalid name', severity: 'error', row })
              return
            }

            const hasSequence = !!(enrichedModule.sequence && enrichedModule.sequence.length > 0)

            if ((moduleType === 'knockout' || moduleType === 'knockdown') && !hasSequence) {
              issues.push({
                gene: geneName,
                reason: moduleType === 'knockout' ? 'gRNA sequence not available for knockout import' : 'shRNA sequence not available for knockdown import',
                severity: 'error',
                row
              })
              return
            }

            moduleResults.push({
              module: {
                ...enrichedModule,
                id: moduleId,
                name: finalName,
                type: moduleType,
                description: enrichedModule.description || (hasSequence ? `Human gene ${finalName}` : `Human gene ${finalName} (sequence not found)`)
              },
              order
            })

            if (hasSequence) {
              withSequences += 1
            } else {
              placeholders += 1
              issues.push({ gene: geneName, reason: 'Sequence not found; added as placeholder module', severity: 'warning', row })
            }
          } catch (error: any) {
            if (moduleType === 'knockout' || moduleType === 'knockdown') {
              issues.push({
                gene: geneName,
                reason: error?.message ? String(error.message) : `Failed to enrich ${moduleType.toUpperCase()} construct`,
                severity: 'error',
                row
              })
              return
            }

            moduleResults.push({
              module: {
                ...baseModule,
                description: `Human gene ${geneName} (sequence not found)`
              },
              order
            })
            placeholders += 1
            issues.push({
              gene: geneName,
              reason: `${error?.message ? String(error.message) + '. ' : ''}Added as placeholder module`,
              severity: 'warning',
              row
            })
          }
        }

        async function worker() {
          while (queue.length > 0) {
            const next = queue.shift()
            if (!next) break
            await processEntry(next)
          }
        }

        await Promise.all(Array.from({ length: concurrency }, () => worker()))

        moduleResults.sort((a, b) => a.order - b.order)
        const finalModules = moduleResults.map(item => item.module)

        if (finalModules.length > 0) {
          onCustomModulesChange([...customModules, ...finalModules])

          const newModuleIds = finalModules.map(m => m.id)

          const updatedFolders = [...folders]
          const totalIdx = updatedFolders.findIndex(f => f.id === 'total-library')
          if (totalIdx >= 0) {
            const total = { ...updatedFolders[totalIdx] }
            total.modules = [...total.modules, ...newModuleIds]
            updatedFolders[totalIdx] = total
          } else {
            updatedFolders.unshift({ id: 'total-library', name: 'Total Library', modules: [...newModuleIds], open: false })
          }

          const newFolder = {
            id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: folderName,
            modules: newModuleIds,
            open: false
          }

          setFolders([...updatedFolders, newFolder])
          setSelectedFolderId(newFolder.id)
        }

        const durationMs = Date.now() - startedAt
        const errorCount = issues.filter(i => i.severity === 'error').length
        const warningCount = issues.filter(i => i.severity === 'warning').length

        const messages: string[] = []
        if (finalModules.length > 0) messages.push(`Added ${finalModules.length} gene${finalModules.length === 1 ? '' : 's'} to '${folderName}'`)
        if (withSequences > 0) messages.push(`${withSequences} with sequences`)
        if (placeholders > 0) messages.push(`${placeholders} placeholder${placeholders === 1 ? '' : 's'}`)

        const summary = messages.length > 0 ? `${messages.join(' · ')} in ${(durationMs / 1000).toFixed(durationMs > 2000 ? 1 : 2)}s.` : ''

        if (finalModules.length === 0) {
          const reason = errorCount > 0 ? `Skipped ${errorCount} gene${errorCount === 1 ? '' : 's'} due to errors.` : 'Could not add any genes from the import.'
          toast.error(`${reason}`, { id: toastId, duration: 7000 })
        } else if (errorCount > 0) {
          toast.warning(`${summary} Skipped ${errorCount} gene${errorCount === 1 ? '' : 's'} (see notes).`, { id: toastId, duration: 7000 })
        } else if (warningCount > 0) {
          toast.info(`${summary} ${warningCount} warning${warningCount === 1 ? '' : 's'} recorded.`, { id: toastId, duration: 6000 })
        } else {
          toast.success(summary || `Successfully added ${finalModules.length} gene${finalModules.length === 1 ? '' : 's'}.`, { id: toastId, duration: 5000 })
        }

        const sortedIssues = [...issues].sort((a, b) => {
          if (a.severity === b.severity) {
            return (a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER)
          }
          return a.severity === 'error' ? -1 : 1
        })

        setImportReport({
          folderName,
          totalRows: rows.length,
          parsedGenes: pendingGenes.length,
          addedModules: finalModules.length,
          withSequences,
          placeholders,
          durationMs,
          issues: sortedIssues,
          errorCount,
          warningCount
        })
      } catch (error) {
        console.error('Error processing gene names:', error)
        toast.error('An error occurred while processing genes', { id: toastId, duration: 6000 })
      } finally {
        setIsLibraryLoading(false)
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

  // Load the curated CACTUS meta-library sub-libraries: the protein-coding
  // presets (full-length CARs, CAR binder/specificity domains, CAR signaling
  // domains, synthetic genes) from the bundled knock-in data, plus the
  // natural-gene knockout / knockdown / overexpression and microRNA target
  // lists with sequences resolved at load time.
  async function handleLoadCactus() {
    if (folders.some(f => f.name.startsWith('CACTUS · '))) {
      toast.info('CACTUS sub-libraries are already loaded')
      return
    }

    setIsLibraryLoading(true)
    const toastId = toast.loading('Loading CACTUS meta-library...', {
      description: 'Resolving curated target sequences...'
    })

    try {
      const { modules, folders: cactusFolders } = await buildCactusLibrariesAsync()
      if (modules.length === 0) {
        toast.error('CACTUS library data is unavailable', { id: toastId })
        return
      }

      const existingIds = new Set(customModules.map(m => m.id))
      const newModules = modules.filter(m => !existingIds.has(m.id))
      if (newModules.length > 0) {
        onCustomModulesChange([...customModules, ...newModules])
      }

      const updatedFolders = [...folders]
      const totalIdx = updatedFolders.findIndex(f => f.id === 'total-library')
      const allIds = modules.map(m => m.id)
      if (totalIdx >= 0) {
        updatedFolders[totalIdx] = {
          ...updatedFolders[totalIdx],
          modules: Array.from(new Set([...updatedFolders[totalIdx].modules, ...allIds])),
        }
      }
      const foldersToAdd = cactusFolders.filter(cf => !folders.some(f => f.name === cf.name))
      setFolders([...updatedFolders, ...foldersToAdd])

      if (foldersToAdd.length === 0) {
        toast.info('CACTUS sub-libraries are already loaded', { id: toastId })
      } else {
        toast.success(
          `Loaded ${foldersToAdd.length} CACTUS sub-librar${foldersToAdd.length === 1 ? 'y' : 'ies'} (${newModules.length} elements)`,
          { id: toastId, duration: 6000 }
        )
      }
    } catch (error: any) {
      console.error('[CACTUS] Failed to load meta-library:', error)
      toast.error(`Failed to load CACTUS: ${error?.message || 'unknown error'}`, { id: toastId })
    } finally {
      setIsLibraryLoading(false)
    }
  }

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
      case 'domain': return '⊕';
      default: return '';
    }
  }

  return (
    <>
      {showSyntheticSelector && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 sm:p-6 z-50"
          onClick={() => setShowSyntheticSelector(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SyntheticGeneSelector
              onGeneSelect={handleSyntheticGeneSelect}
              onCustomSequence={handleCustomSequence}
              onClose={() => setShowSyntheticSelector(false)}
            />
          </div>
        </div>
      )}
      <Card className="p-6 border border-border shadow-sm">
        <TypedHeading text="1. Desired Genetic Perturbations (Pooled)" className="text-xl font-bold text-gray-900 dark:text-white mb-4" />

      {/* Perturbation Type - button selector */}
      <div className="mb-5 p-4 rounded-lg bg-white dark:bg-gray-800 border border-border shadow-sm">
        <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Perturbation Type</div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(option => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              size="sm"
              className={`flex-1 min-w-[80px] transition-all duration-200 ${
                selectedType === option.value 
                  ? option.className + ' shadow-md scale-[1.02]'
                  : option.outlineClassName + ' hover:shadow-md hover:scale-[1.02] hover:font-semibold'
              }`}
              onClick={() => {
                setSelectedType(option.value as any)
                if (option.value === 'knockin') {
                  setShowSyntheticSelector(true)
                }
              }}
            >
              <span className="drop-shadow-sm">{option.icon} {option.label}</span>
            </Button>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 font-medium">*indicates knock-ins of synthetic genes</p>
      </div>

      {/* Toolbar: Folder select + import/export + create library */}
      <div className="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 items-center">
            <span className="text-sm font-medium">Add to library:</span>
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

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowScanGenesDialog(true)} className="font-semibold shadow-sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Library
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLibrary}>Export Library</Button>
            <Button variant="outline" size="sm" onClick={handleLoadCactus} title="Load the curated protein-coding CACTUS meta-library sub-libraries">Load CACTUS</Button>
            <input
              type="file"
              accept=".csv,.xlsx"
              ref={geneFileInputRef}
              style={{ display: 'none' }}
              onChange={handleGeneFileChange}
            />
            <input
              type="text"
              placeholder="New library name..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="h-9 w-48 md:w-56 border border-border rounded px-2 py-1 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const name = newFolderName.trim()
                  if (!name) return
                  if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                    toast.error('A library with this name already exists')
                    return
                  }
                  const newId = Date.now() + '-' + Math.random()
                  setFolders([
                    ...folders,
                    { id: newId, name, modules: [], open: false }
                  ])
                  setNewFolderName('')
                  setSelectedFolderId(newId)
                  toast.success(`Created library '${name}'`)
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const name = newFolderName.trim()
                if (!name) return
                if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                  toast.error('A library with this name already exists')
                  return
                }
                const newId = Date.now() + '-' + Math.random()
                setFolders([
                  ...folders,
                  { id: newId, name, modules: [], open: false }
                ])
                setNewFolderName('')
                setSelectedFolderId(newId)
                toast.success(`Created library '${name}'`)
              }}
            >
              Create
            </Button>
          </div>
        </div>
        <div className="relative mt-3">
          <UnifiedGeneSearch
            onModuleAdd={handleUnifiedModuleAdd}
            placeholder="Search or enter gene symbol..."
            showSelectedModules={false}
            showTypeButtons={false}
            defaultType={selectedType}
            hideInlineTypeToggle={true}
            className=""
            disabled={addingModule}
          />
          {addingModule && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-t-primary border-r-primary border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        {/* Type dropdown removed in favor of button selector above */}
      </div>
      {/* Search */}
      {/* Folder/Library display */}
      <div className="mb-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            {isLibraryLoading && (
              <div className="absolute inset-0 bg-background/80 z-10 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Processing import...</span>
              </div>
            )}
            <Droppable droppableId="module-selector-folders" type="library" isDropDisabled={isLibraryLoading}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {/* Ensure a dedicated Constants folder exists */}
                  {(!folders.some(f => f.id === CONSTANTS_FOLDER_ID)) && (
                    <div className="mb-3 rounded-lg border border-border bg-card shadow-sm">
                      <div className="flex items-center px-3 py-2 select-none">
                        <span className="font-semibold">Constants</span>
                        <Badge variant="secondary" className="ml-2">0</Badge>
                      </div>
                      <div className="px-3 pb-3 text-sm text-muted-foreground">Create a folder named "Constants" to pin single-gene constants.</div>
                    </div>
                  )}
                  {folders.map((folder, index) => (
                    <Draggable key={folder.id} draggableId={folder.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`mb-3 rounded-lg border border-border bg-card transition-all shadow-sm ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="flex items-center cursor-pointer px-3 py-2 select-none hover:bg-muted/50"
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
                                <span className="font-semibold text-gray-800">{folder.name}</span>
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
                                  className={`flex flex-wrap gap-2 p-3 bg-muted/60 border-t border-border rounded-b-lg min-h-[56px] transition-all ${snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
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

          {!isLibraryLoading && importReport && importReport.issues.length > 0 && (
            <aside className="w-full shrink-0 rounded-lg border border-border bg-card shadow-sm lg:w-72 xl:w-80">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Import notes</p>
                    <p className="text-xs text-muted-foreground">
                      {importReport.folderName} • {importReport.errorCount} error{importReport.errorCount === 1 ? '' : 's'}, {importReport.warningCount} warning{importReport.warningCount === 1 ? '' : 's'} • {(importReport.durationMs / 1000).toFixed(importReport.durationMs > 2000 ? 1 : 2)}s
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setImportReport(null)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {importReport.issues.slice(0, 40).map((issue, idx) => {
                    const severityStyles = issue.severity === 'error'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                    const Icon = issue.severity === 'error' ? AlertTriangle : Info
                    return (
                      <div
                        key={`${issue.gene}-${issue.row ?? 'na'}-${idx}`}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${severityStyles}`}
                      >
                        <Icon className="mt-0.5 h-3.5 w-3.5" />
                        <div className="leading-snug">
                          <span className="font-semibold">{issue.gene}</span>
                          <span className="block text-[11px] text-current/90">{issue.reason}</span>
                        </div>
                      </div>
                    )
                  })}
                  {importReport.issues.length > 40 && (
                    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      +{importReport.issues.length - 40} more notes hidden
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
      {/* Integrations section removed */}
      </Card>

      {/* Library Conversion Dialog */}
      {convertingFolderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-semibold mb-4">Convert Library Type</h3>
            <p className="text-sm text-muted-foreground mb-4">
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
                className="px-4 py-2 text-muted-foreground border border-border rounded hover:bg-muted/50"
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
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Import Library</h3>
            
            {/* Perturbation Type Selector - Moved to top */}
            <div className="mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 border border-border shadow-sm">
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
              <div className="border border-border rounded-lg p-5 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow duration-200">
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
              <div className="border border-border rounded-lg p-5 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow duration-200">
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
