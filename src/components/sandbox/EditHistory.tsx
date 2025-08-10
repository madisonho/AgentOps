import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Edit3, Clock } from "lucide-react";
import { EditHistory } from "./AIFlowCanvas";

interface EditHistoryProps {
  history: EditHistory[];
}

export function EditHistory({ history }: EditHistoryProps) {
  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'keywords':
        return '💬';
      case 'count':
        return '📊';
      case 'param':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const getFieldColor = (field: string) => {
    switch (field) {
      case 'keywords':
        return 'bg-blue-100 text-blue-800';
      case 'count':
        return 'bg-green-100 text-green-800';
      case 'param':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="p-4 h-[300px] flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4" />
        <h3 className="text-lg font-semibold">Edit History</h3>
        <Badge variant="secondary" className="ml-auto">{history.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">Track all changes made to nodes</p>
      <ScrollArea className="flex-1">
        <ul className="space-y-3 pr-3">
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-primary/20 pl-3 py-2">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-secondary p-2 text-secondary-foreground">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{entry.nodeLabel}</span>
                    <Badge variant="outline" className={`text-xs ${getFieldColor(entry.field)}`}>
                      {getFieldIcon(entry.field)} {entry.field}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {entry.oldValue} → {entry.newValue}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {entry.timestamp}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {!history.length && (
            <li className="text-sm text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" /> No edits yet
            </li>
          )}
        </ul>
      </ScrollArea>
    </Card>
  );
}

export default EditHistory;
