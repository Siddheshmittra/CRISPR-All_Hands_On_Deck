import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import type { Module } from '@/lib/types'

interface LibraryViewerProps {
  folders: Array<{ id: string; name: string; modules: string[]; open?: boolean }>
  customModules: Module[]
  showTotal?: boolean
  embedded?: boolean
}

export function LibraryViewer({ folders, customModules, showTotal = false, embedded = false }: LibraryViewerProps) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})

  const visibleFolders = useMemo(() => {
    return folders.filter(f => (showTotal ? true : f.id !== 'total-library'))
  }, [folders, showTotal])

  const getModules = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return [] as Module[]
    return folder.modules.map(id => customModules.find(m => m.id === id)).filter(Boolean) as Module[]
  }

  const content = (
      <div className="space-y-2">
        {visibleFolders.map((folder) => {
          const isOpen = openIds[folder.id] ?? true
          const mods = getModules(folder.id)
          return (
            <div key={folder.id} className="border rounded bg-muted/60">
              <div
                className="flex items-center cursor-pointer px-2 py-1.5 select-none hover:bg-muted/70"
                onClick={() => setOpenIds(prev => ({ ...prev, [folder.id]: !isOpen }))}
              >
                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                <div className="font-semibold mr-2 truncate">{folder.name}</div>
                <Badge variant="secondary">{mods.length}</Badge>
              </div>
              {isOpen && (
                <div className="flex flex-wrap gap-2 p-2 bg-background/60">
                  {mods.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No modules</div>
                  ) : (
                    mods.map(m => (
                      <div
                        key={m.id}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          m.type === 'overexpression' ? 'bg-overexpression/90 text-overexpression-foreground border-overexpression/30' :
                          m.type === 'knockout' ? 'bg-knockout/90 text-knockout-foreground border-knockout/30' :
                          m.type === 'knockdown' ? 'bg-knockdown/90 text-knockdown-foreground border-knockdown/30' :
                          m.type === 'knockin' ? 'bg-knockin/90 text-knockin-foreground border-knockin/30' :
                          'bg-card text-card-foreground border-border'
                        }`}
                        title={`${m.name} [${m.type}]`}
                      >
                        {m.name} [{m.type}]
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
  )

  if (embedded) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Planned Libraries</h3>
        {content}
      </div>
    )
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Planned Libraries</h2>
      {content}
    </Card>
  )
}



