import { memo, useCallback, useMemo } from "react";
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

export type StepData = {
  label: string;
  param: number; // 0-100
  correctness: number; // 0-100
  onChange?: (v: number) => void;
  onInspect?: () => void;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

const StepNode = memo(({ id, data }: NodeProps<any>) => {
  return (
    <div className="w-56 rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{data.label}</div>
        <div className="text-xs text-muted-foreground">{Math.round(data.correctness)}%</div>
      </div>
      <div className="space-y-2">
        <Slider
          value={[data.param]}
          onValueChange={(v) => data.onChange?.(v[0] ?? 0)}
          min={0}
          max={100}
          step={1}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Param</span>
          <Button size="sm" variant="outline" onClick={() => data.onInspect?.()}>
            Inspect
          </Button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
});

const nodeTypes = { step: StepNode } as any;

export interface AIFlowCanvasProps {
  onStepChange?: (id: string, payload: { label: string; param: number; correctness: number }) => void;
  onInspect?: (payload: { id: string; label: string; param: number; correctness: number }) => void;
}

export function AIFlowCanvas({ onStepChange, onInspect }: AIFlowCanvasProps) {
  const initialNodes = useMemo<Node<StepData>[]>(
    () => [
      {
        id: "n1",
        type: "step",
        position: { x: 50, y: 60 },
        data: { label: "Input", param: 40, correctness: 40 },
      },
      {
        id: "n2",
        type: "step",
        position: { x: 320, y: 10 },
        data: { label: "Model Inference", param: 65, correctness: 65 },
      },
      {
        id: "n3",
        type: "step",
        position: { x: 620, y: 60 },
        data: { label: "Post-Process", param: 55, correctness: 55 },
      },
      {
        id: "n4",
        type: "step",
        position: { x: 900, y: 35 },
        data: { label: "Output", param: 70, correctness: 70 },
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
          const correctness = clamp(15 + param * 0.85);
          const newData = { ...n.data, param, correctness } as StepData;
          onStepChange?.(id, { label: (n.data as StepData).label, param, correctness });
          return { ...n, data: newData } as Node<StepData>;
        })
      );
    },
    [onStepChange, setNodes]
  );

  // Inject handlers into node data so StepNode can call them
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as StepData),
          onChange: (v: number) => updateNodeParam(n.id, v),
          onInspect: () => {
            const d = n.data as StepData;
            onInspect?.({ id: n.id, label: d.label, param: d.param, correctness: d.correctness });
          },
        },
      })),
    [nodes, onInspect, updateNodeParam]
  );

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
    </div>
  );
}

export default AIFlowCanvas;
