import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, MousePointer2 } from "lucide-react";

export type ActionItem = {
  id: string;
  ts: string;
  stepId: string;
  label: string;
  value: number;
};

interface ActionTimelineProps {
  items: ActionItem[];
}

export function ActionTimeline({ items }: ActionTimelineProps) {
  return (
    <Card className="p-4 h-[300px] flex flex-col">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">Agent Actions</h3>
        <p className="text-sm text-muted-foreground">Replay of tuning and evaluation steps</p>
      </div>
      <ScrollArea className="flex-1">
        <ul className="space-y-3 pr-3">
          {items.map((it) => (
            <li key={it.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className="rounded-md bg-secondary p-2 text-secondary-foreground">
                <MousePointer2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{it.label}</div>
                <div className="text-xs text-muted-foreground">Step {it.stepId}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{Math.round(it.value)}%</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">{it.ts}</span>
              </div>
            </li>
          ))}
          {!items.length && (
            <li className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> No actions yet
            </li>
          )}
        </ul>
      </ScrollArea>
    </Card>
  );
}

export default ActionTimeline;
