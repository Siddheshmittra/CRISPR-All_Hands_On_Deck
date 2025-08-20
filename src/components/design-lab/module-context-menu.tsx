import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Module } from '@/lib/types'
import { 
  generateFasta, 
  downloadFasta, 
  getUniProtUrl, 
  hasSequence, 
  getModuleSequence 
} from '@/lib/fasta-uniprot'
import { toast } from 'sonner'
import { Download, ExternalLink, FileText, Database, Link as LinkIcon } from 'lucide-react'

interface ModuleContextMenuProps {
  module: Module
  children: React.ReactNode
}

export const ModuleContextMenu: React.FC<ModuleContextMenuProps> = ({ 
  module, 
  children 
}) => {
  const isOverexpression = module.type === 'overexpression'
  const hasSequenceData = hasSequence(module)

  const handleDownloadFasta = () => {
    try {
      const sequence = getModuleSequence(module)
      if (!sequence) {
        toast.error('No sequence data available for this module')
        return
      }
      
      const fastaContent = generateFasta(module, sequence)
      const filename = `${module.name || module.gene_id || module.id}_${module.type}`
      downloadFasta(fastaContent, filename)
      toast.success('FASTA file downloaded successfully')
    } catch (error) {
      console.error('Error downloading FASTA:', error)
      toast.error('Failed to download FASTA file')
    }
  }

  const handleOpenUniProt = () => {
    const geneSymbol = module.name || module.gene_id
    if (!geneSymbol) {
      toast.error('No gene symbol available for UniProt lookup')
      return
    }
    
    const url = getUniProtUrl(geneSymbol)
    window.open(url, '_blank')
  }

  const getSourceEntryUrl = (): string | null => {
    // Prefer explicit Ensembl ID for natural genes
    const ensemblId = module.ensemblGeneId || module.gene_id
    if (module.sequenceSource === 'ensembl_grch38' || module.sequenceSource === 'ensembl_grch37') {
      if (ensemblId) {
        return `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(ensemblId)}`
      }
      if (module.name) {
        // Fallback to search page if we lack a stable ID
        return `https://www.ensembl.org/Multi/Search/Results?q=${encodeURIComponent(module.name)};site=ensembl`
      }
    }
    // Local JSON sources (KD/KO) not applicable for OE, but handle gracefully
    if (module.sequenceSource === 'shRNA.json' || module.sequenceSource === 'gRNA.json') {
      // No external source page; guide user to UniProt search by name if present
      if (module.name) {
        return getUniProtUrl(module.name)
      }
    }
    return null
  }

  const handleOpenSourceEntry = () => {
    const url = getSourceEntryUrl()
    if (!url) {
      toast.error('No source entry available for this module')
      return
    }
    window.open(url, '_blank')
  }

  const handleCopySequence = () => {
    const sequence = getModuleSequence(module)
    if (!sequence) {
      toast.error('No sequence data available')
      return
    }
    
    navigator.clipboard.writeText(sequence)
    toast.success('Sequence copied to clipboard')
  }

  const handleCopyFasta = () => {
    try {
      const sequence = getModuleSequence(module)
      if (!sequence) {
        toast.error('No sequence data available')
        return
      }
      
      const fastaContent = generateFasta(module, sequence)
      navigator.clipboard.writeText(fastaContent)
      toast.success('FASTA format copied to clipboard')
    } catch (error) {
      console.error('Error copying FASTA:', error)
      toast.error('Failed to copy FASTA format')
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Module Info */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium">{module.name || module.gene_id || module.id}</div>
          <div className="capitalize">{module.type}</div>
          {module.description && (
            <div className="text-xs truncate">{module.description}</div>
          )}
        </div>
        
        <ContextMenuSeparator />
        
        {/* Sequence Actions - Only for overexpression modules */}
        {isOverexpression && (
          <>
            <ContextMenuItem 
              onClick={handleCopySequence}
              disabled={!hasSequenceData}
            >
              <FileText className="mr-2 h-4 w-4" />
              Copy Sequence
            </ContextMenuItem>
            
            <ContextMenuItem 
              onClick={handleCopyFasta}
              disabled={!hasSequenceData}
            >
              <FileText className="mr-2 h-4 w-4" />
              Copy FASTA Format
            </ContextMenuItem>
            
            <ContextMenuItem 
              onClick={handleDownloadFasta}
              disabled={!hasSequenceData}
            >
              <Download className="mr-2 h-4 w-4" />
              Download FASTA
            </ContextMenuItem>
            
            <ContextMenuSeparator />
          </>
        )}
        
        {/* UniProt Actions - Only for overexpression modules */}
        {isOverexpression && (
          <ContextMenuItem onClick={handleOpenUniProt}>
            <Database className="mr-2 h-4 w-4" />
            Open in UniProt
            <ExternalLink className="ml-auto h-4 w-4" />
          </ContextMenuItem>
        )}

        {/* Source entry link based on sequenceSource (shown for OE if resolvable) */}
        {isOverexpression && (
          <ContextMenuItem onClick={handleOpenSourceEntry} disabled={!getSourceEntryUrl()}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Open Source Entry
            <ExternalLink className="ml-auto h-4 w-4" />
          </ContextMenuItem>
        )}
        
        {/* Show message for non-overexpression modules */}
        {!isOverexpression && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            FASTA/UniProt options only available for overexpression modules
          </div>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
