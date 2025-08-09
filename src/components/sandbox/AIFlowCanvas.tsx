import { memo, useCallback, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  NodeProps,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type StepData = {
  label: string;
  model: string;
  param: number; // 0-100
  correctness: number; // 0-100
  keywords: string;
  count: number; // e.g., max candidates
  canAdjustParam?: boolean;
  onChange?: (v: number) => void;
  onEdit?: () => void;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function computeMetrics(d: { param: number; keywords: string; count: number }) {
  const kwCount = (d.keywords?.trim() || "").split(/\s+/).filter(Boolean).length;
  const discoveryEfficiency = clamp(30 + 0.6 * d.param + 0.4 * Math.min(d.count, 100));
  const sourceDiversity = clamp(20 + kwCount * 8);
  const timeToShortlist = clamp(100 - (d.count * 2 + d.param * 0.5));
  const fitValue = clamp(0.5 * d.param + 0.2 * Math.min(kwCount * 10, 100) + 0.3 * Math.min(d.count, 100));
  const correctness = Math.round((discoveryEfficiency + sourceDiversity + fitValue) / 3);
  return { discoveryEfficiency, sourceDiversity, timeToShortlist, fitValue, correctness };
}

const StepNode = memo(({ id, data }: NodeProps<any>) => {
  const metrics = computeMetrics({ param: data.param, keywords: data.keywords, count: data.count });
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="w-56 rounded-lg border bg-card text-card-foreground shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">{data.label}</div>
            <div className="text-xs text-muted-foreground">{Math.round(data.correctness)}%</div>
          </div>
          <div className="space-y-2">
            {data.canAdjustParam ? (
              <>
                <Slider
                  value={[data.param]}
                  onValueChange={(v) => data.onChange?.(v[0] ?? 0)}
                  min={0}
                  max={100}
                  step={1}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Param</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No adjustable slider</div>
            )}
          </div>
          <Handle type="source" position={Position.Right} />
          <Handle type="target" position={Position.Left} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="center">
        <div className="space-y-2">
          <div className="text-sm font-medium">Model: {data.model}</div>
          <div className="text-xs text-muted-foreground">Keywords: {data.keywords || "—"}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Discovery efficiency: {Math.round(metrics.discoveryEfficiency)}%</div>
            <div>Source diversity: {Math.round(metrics.sourceDiversity)}%</div>
            <div>Time-to-shortlist: {Math.round(metrics.timeToShortlist)}%</div>
            <div>Fit & value: {Math.round(metrics.fitValue)}%</div>
          </div>
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={() => data.onEdit?.()}>
              Edit
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

const nodeTypes = { step: StepNode } as any;

export interface AIFlowCanvasProps {
  onStepChange?: (id: string, payload: { label: string; param: number; correctness: number }) => void;
  onInspect?: (payload: { id: string; label: string; param: number; correctness: number }) => void;
  chatQuery?: string;
  chatVersion?: number;
}

export function AIFlowCanvas({ onStepChange, onInspect, chatQuery, chatVersion }: AIFlowCanvasProps) {
  const initialNodes = useMemo<Node<StepData>[]>(
    () => [
      {
        id: "n1",
        type: "step",
        position: { x: 50, y: 60 },
        data: {
          label: "Chat",
          model: "gpt-4o",
          param: 40,
          correctness: 40,
          keywords: "",
          count: 10,
          canAdjustParam: false,
        },
      },
      {
        id: "n2",
        type: "step",
        position: { x: 320, y: 10 },
        data: {
          label: "Model Inference",
          model: "claude-3.5",
          param: 65,
          correctness: 65,
          keywords: "",
          count: 20,
          canAdjustParam: true,
        },
      },
      {
        id: "n3",
        type: "step",
        position: { x: 620, y: 60 },
        data: {
          label: "Post-Process",
          model: "gpt-4.1-mini",
          param: 55,
          correctness: 55,
          keywords: "",
          count: 15,
          canAdjustParam: true,
        },
      },
      {
        id: "n4",
        type: "step",
        position: { x: 900, y: 35 },
        data: {
          label: "Output",
          model: "reranker-v2",
          param: 70,
          correctness: 70,
          keywords: "",
          count: 5,
          canAdjustParam: false,
        },
      },
    ],
    []
  );

  const initialEdges = useMemo<Edge[]>(
    () => [
      { id: "e1-2", source: "n1", target: "n2" },
      { id: "e2-3", source: "n2", target: "n3" },
      { id: "e3-4", source: "n3", target: "n4" },
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const updateNodeParam = useCallback(
    (id: string, param: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as StepData), param };
          const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count });
          const newData = { ...d, correctness: m.correctness } as StepData;
          onStepChange?.(id, { label: newData.label, param: newData.param, correctness: newData.correctness });
          return { ...n, data: newData } as Node<StepData>;
        })
      );
    },
    [onStepChange, setNodes]
  );

  const updateNodeFields = useCallback(
    (id: string, fields: Partial<Pick<StepData, "keywords" | "count" | "param">>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as StepData), ...fields };
          const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count });
          const newData = { ...d, correctness: m.correctness } as StepData;
          onStepChange?.(id, { label: newData.label, param: newData.param, correctness: newData.correctness });
          return { ...n, data: newData } as Node<StepData>;
        })
      );
    },
    [onStepChange, setNodes]
  );

  const [editingId, setEditingId] = useState<string | null>(null);

  // Inject handlers into node data so StepNode can call them
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as StepData),
          onChange: (v: number) => updateNodeParam(n.id, v),
          onEdit: () => setEditingId(n.id),
        },
      })),
    [nodes, updateNodeParam]
  );

  // Sync chat query into first (+ propagate to next) nodes
  useEffect(() => {
    if (!chatQuery) return;
    // Update Chat node
    updateNodeFields("n1", { keywords: chatQuery });
    // Propagate to next node and slightly adjust param
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== "n2") return n;
        const d = { ...(n.data as StepData) };
        const bumped = clamp(d.param + 5);
        const d2 = { ...d, keywords: chatQuery, param: d.canAdjustParam ? bumped : d.param };
        const m = computeMetrics({ param: d2.param, keywords: d2.keywords, count: d2.count });
        const newData = { ...d2, correctness: m.correctness } as StepData;
        onStepChange?.("n2", { label: newData.label, param: newData.param, correctness: newData.correctness });
        return { ...n, data: newData } as Node<StepData>;
      })
    );
    // Emit change for Chat node
    const n1 = nodes.find((n) => n.id === "n1") as Node<StepData> | undefined;
    if (n1) {
      const d = { ...n1.data, keywords: chatQuery } as StepData;
      const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count });
      onStepChange?.("n1", { label: d.label, param: d.param, correctness: m.correctness });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatQuery, chatVersion]);

  return (
    <div className="h-[380px] rounded-xl border bg-card/60 backdrop-blur-sm ambient-surface">
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="reactflow-canvas"
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} size={1} />
      </ReactFlow>

      <Sheet open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px]">
          {editingId && (
            <div className="space-y-4">
              {(() => {
                const n = nodes.find((x) => x.id === editingId) as Node<StepData> | undefined;
                if (!n) return null;
                const d = n.data as StepData;
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium">{d.label}</div>
                      <div className="text-xs text-muted-foreground">Model: {d.model}</div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kw">Keywords</Label>
                      <Input id="kw" value={d.keywords} placeholder="e.g., logistics, eco-friendly, express" onChange={(e) => updateNodeFields(n.id, { keywords: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnt">Max candidates</Label>
                      <Input id="cnt" type="number" min={1} max={999} value={d.count} onChange={(e) => updateNodeFields(n.id, { count: Number(e.target.value || 0) })} />
                    </div>
                    {d.canAdjustParam && (
                      <div className="space-y-2">
                        <Label>Param</Label>
                        <Slider value={[d.param]} min={0} max={100} step={1} onValueChange={(v) => updateNodeFields(n.id, { param: v[0] ?? 0 })} />
                      </div>
                    )}
                    <div className="pt-2">
                      <Button variant="outline" onClick={() => setEditingId(null)}>Close</Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );

}

export default AIFlowCanvas;
