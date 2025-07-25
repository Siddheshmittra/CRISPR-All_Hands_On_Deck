import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Download } from "lucide-react"

interface Module {
  id: string
  name: string
  type: "overexpression" | "knockout" | "knockdown"
  description?: string
  sequence?: string
}

interface Cassette {
  id: string
  modules: Module[]
}

interface CassetteBatchProps {
  cassetteBatch: Cassette[]
  onDeleteCassette: (cassetteId: string) => void
  onExportBatch: () => void
}

export const CassetteBatch = ({ cassetteBatch, onDeleteCassette, onExportBatch }: CassetteBatchProps) => {
  if (cassetteBatch.length === 0) {
    return null
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Cassette Batch</h2>
        <Button variant="outline" size="sm" onClick={onExportBatch}>
          <Download className="h-4 w-4 mr-2" />
          Export Batch
        </Button>
      </div>
      <div className="space-y-4">
        {cassetteBatch.map((cassette, index) => (
          <div key={cassette.id} className="p-4 bg-muted rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold">Cassette {index + 1}</div>
              <p className="text-sm font-mono break-all">
                {cassette.modules.map(m => m.name).join(' → ')}
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all mt-1">
                Sequence: {cassette.modules.map(m => m.sequence || '').join('')}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDeleteCassette(cassette.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
} 