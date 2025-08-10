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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { VendorSearch } from "./VendorSearch";
import { useVendorShortlist } from "@/hooks/use-vendors";
import type { Vendor } from "@/lib/api";

export type EditHistory = {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  field: string;
  oldValue: string | number;
  newValue: string | number;
  description: string;
};

export type StepData = {
  label: string;
  model: string;
  param: number; // 0-100
  correctness: number; // 0-100
  keywords: string;
  count: number; // e.g., max candidates
  weights?: Record<string, number>; // For weighting node
  onChange?: (v: number) => void;
  onEdit?: () => void;
  nodeType?: 'prompt' | 'vendor-search' | 'shortlisting' | 'weighting' | 'output';
  vendors?: Vendor[]; // Real vendor data
  searchResults?: number; // Number of search results
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function computeMetrics(d: { param: number; keywords: string; count: number; nodeType?: string; weights?: Record<string, number> }) {
  const kwCount = (d.keywords?.trim() || "").split(/\s+/).filter(Boolean).length;
  
  switch (d.nodeType) {
    case 'prompt':
      const promptTime = 0.3 + (kwCount * 0.1) + (d.param * 0.005);
      return {
        latency: clamp(100 - d.param * 0.8),
        clarity: clamp(20 + d.param * 0.8),
        specificity: clamp(10 + kwCount * 5),
        timeTaken: Math.round(promptTime * 100) / 100,
        correctness: Math.round((100 - d.param * 0.8 + 20 + d.param * 0.8 + 10 + kwCount * 5) / 3)
      };
    
    case 'vendor-search':
      const searchTime = 0.8 + (d.count * 0.05) + (d.param * 0.003);
      return {
        latency: clamp(100 - d.param * 0.6),
        sourceDiversity: clamp(20 + d.count * 2),
        vendorsConsidered: d.count,
        timeTaken: Math.round(searchTime * 100) / 100,
        correctness: Math.round((100 - d.param * 0.6 + 20 + d.count * 2) / 3)
      };
    
    case 'shortlisting':
      const shortlistTime = 0.5 + (d.count * 0.03) + (d.param * 0.004);
      return {
        latency: clamp(100 - d.param * 0.7),
        leadsRejected: Math.max(0, d.count - Math.round(d.param * 0.3)),
        leadsShortlisted: Math.round(d.param * 0.3),
        timeTaken: Math.round(shortlistTime * 100) / 100,
        correctness: Math.round((100 - d.param * 0.7 + d.param * 0.3) / 2)
      };
    
    case 'weighting':
      const weightCount = d.weights ? Object.keys(d.weights).length : 0;
      const totalWeight = d.weights ? Object.values(d.weights).reduce((sum, w) => sum + w, 0) : 0;
      const weightTime = 0.4 + (weightCount * 0.1) + (d.param * 0.002);
      return {
        constraintsIdentified: weightCount,
        latency: clamp(100 - d.param * 0.5),
        totalWeight: totalWeight,
        timeTaken: Math.round(weightTime * 100) / 100,
        correctness: Math.round((weightCount * 10 + 100 - d.param * 0.5) / 2)
      };
    
    case 'output':
      const outputTime = 0.2 + (d.param * 0.001);
      return {
        latency: clamp(100 - d.param * 0.3),
        timeTaken: Math.round(outputTime * 100) / 100,
        correctness: 100
      };
    
    default:
      // Fallback to original metrics
      const discoveryEfficiency = clamp(30 + 0.6 * d.param + 0.4 * Math.min(d.count, 100));
      const sourceDiversity = clamp(20 + kwCount * 8);
      const timeToShortlist = clamp(100 - (d.count * 2 + d.param * 0.5));
      const fitValue = clamp(0.5 * d.param + 0.2 * Math.min(kwCount * 10, 100) + 0.3 * Math.min(d.count, 100));
      const correctness = Math.round((discoveryEfficiency + sourceDiversity + timeToShortlist + fitValue) / 4);
      return { discoveryEfficiency, sourceDiversity, timeToShortlist, fitValue, correctness };
  }
}

const StepNode = memo(({ id, data }: NodeProps<any>) => {
  const metrics = computeMetrics({ param: data.param, keywords: data.keywords, count: data.count, nodeType: data.nodeType, weights: data.weights });
  
  const renderMetrics = () => {
    switch (data.nodeType) {
      case 'prompt':
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Latency: {Math.round(metrics.latency)}%</div>
            <div>Clarity: {Math.round(metrics.clarity)}%</div>
            <div>Specificity: {Math.round(metrics.specificity)}%</div>
          </div>
        );
      
      case 'vendor-search':
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Latency: {Math.round(metrics.latency)}%</div>
            <div>Source diversity: {Math.round(metrics.sourceDiversity)}%</div>
            <div>Vendors found: {data.searchResults || metrics.vendorsConsidered}</div>
            {data.vendors && data.vendors.length > 0 && (
              <div>Top result: {data.vendors[0]?.vendor_name}</div>
            )}
          </div>
        );
      
      case 'shortlisting':
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Latency: {Math.round(metrics.latency)}%</div>
            <div>Leads rejected: {metrics.leadsRejected}</div>
            <div>Leads shortlisted: {metrics.leadsShortlisted}</div>
          </div>
        );
      
      case 'weighting':
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Constraints identified: {metrics.constraintsIdentified}</div>
            <div>Latency: {Math.round(metrics.latency)}%</div>
            <div>Total weight: {metrics.totalWeight}</div>
          </div>
        );
      
      case 'output':
        return (
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div>Latency: {Math.round(metrics.latency)}%</div>
          </div>
        );
      
      default:
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Discovery efficiency: {Math.round(metrics.discoveryEfficiency)}%</div>
            <div>Source diversity: {Math.round(metrics.sourceDiversity)}%</div>
            <div>Time-to-shortlist: {Math.round(metrics.timeToShortlist)}%</div>
            <div>Fit & value: {Math.round(metrics.fitValue)}%</div>
          </div>
        );
    }
  };

  // Special rendering for prompt node (no hover card, no click)
  if (data.nodeType === 'prompt') {
    return (
      <div className="w-56 rounded-lg border bg-card text-card-foreground shadow-sm p-3">
        <div className="mb-2">
          <div className="text-sm font-medium">{data.label}</div>
        </div>
        <div className="space-y-2">
          {data.keywords ? (
            <div className="text-xs text-primary font-medium">
              "{data.keywords}"
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Waiting for input...</div>
          )}
        </div>
        <Handle type="source" position={Position.Right} />
        <Handle type="target" position={Position.Left} />
      </div>
    );
  }

  // Special rendering for output node (hover card with latency, click for summary)
  if (data.nodeType === 'output') {
    // Use real vendor data if available, otherwise show placeholder
    const outputData = data.vendors && data.vendors.length > 0 
      ? data.vendors.slice(0, 3).map(vendor => 
          `${vendor.vendor_name} - Score: ${Math.round(vendor.average_rating * 20)}/100 (Price: ${vendor.pricing}, Rating: ${vendor.average_rating})`
        )
      : [
          "No vendors found yet. Search for vendors to see results here.",
          "Try searching for: paint vendors, Wyoming suppliers, or eco-friendly options"
        ];
    
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="w-56 rounded-lg border bg-card text-card-foreground shadow-sm p-3 transition-all duration-300 hover:shadow-xl hover:border-primary/60 hover:scale-105 cursor-pointer group hover:bg-card/80">
            <div className="mb-2">
              <div className="text-sm font-medium group-hover:text-primary transition-colors">{data.label}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground group-hover:text-primary/60 transition-colors">
                Click to view summary
              </div>
            </div>
            <Handle type="source" position={Position.Right} />
            <Handle type="target" position={Position.Left} />
          </div>
        </HoverCardTrigger>
        <HoverCardContent align="center" className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Model: {data.model}</div>
            <div className="text-xs text-muted-foreground">Keywords: {data.keywords || "—"}</div>
            {renderMetrics()}
            <div className="pt-2">
              <div className="text-xs font-medium mb-1">Vendor Results:</div>
              <div className="text-xs space-y-1 text-muted-foreground">
                {outputData.map((item, index) => (
                  <div key={index} className="border-l-2 border-primary/20 pl-2">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={() => data.onEdit?.()}>
                View Summary
              </Button>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Default rendering for other nodes
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="w-56 rounded-lg border bg-card text-card-foreground shadow-sm p-3 transition-all duration-300 hover:shadow-xl hover:border-primary/60 hover:scale-105 cursor-pointer group hover:bg-card/80">
          <div className="mb-2">
            <div className="text-sm font-medium group-hover:text-primary transition-colors">{data.label}</div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground group-hover:text-primary/60 transition-colors">
              Click to view details
            </div>
          </div>
          <Handle type="source" position={Position.Right} />
          <Handle type="target" position={Position.Left} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="center">
        <div className="space-y-2">
          <div className="text-sm font-medium">Model: {data.model}</div>
          <div className="text-xs text-muted-foreground">Keywords: {data.keywords || "—"}</div>
          {renderMetrics()}
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
  onHistoryUpdate?: (history: EditHistory[]) => void;
  onTimeDataUpdate?: (timeData: { stepId: string; stepName: string; timeTaken: number; timestamp: string }[]) => void;
  onReset?: () => void;
  chatQuery?: string;
  chatVersion?: number;
  onVendorsFound?: (vendors: Vendor[]) => void;
}

export function AIFlowCanvas({ onStepChange, onInspect, onHistoryUpdate, onTimeDataUpdate, onReset, chatQuery, chatVersion, onVendorsFound }: AIFlowCanvasProps) {
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [foundVendors, setFoundVendors] = useState<Vendor[]>([]);
  
  const addHistoryEntry = useCallback((nodeId: string, nodeLabel: string, field: string, oldValue: string | number, newValue: string | number) => {
    const historyEntry: EditHistory = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      nodeId,
      nodeLabel,
      field,
      oldValue,
      newValue,
      description: `${nodeLabel}: ${field} changed from ${oldValue} to ${newValue}`
    };
    
    setEditHistory(prev => {
      const newHistory = [historyEntry, ...prev].slice(0, 50); // Keep last 50 entries
      onHistoryUpdate?.(newHistory);
      return newHistory;
    });
  }, [onHistoryUpdate]);
  
  const initialNodes = useMemo<Node<StepData>[]>(
    () => [
      {
        id: "n1",
        type: "step",
        position: { x: 50, y: 60 },
        data: {
          label: "Prompt",
          model: "gpt-4o",
          param: 40,
          correctness: 40,
          keywords: "",
          count: 10,
          nodeType: "prompt",
        },
      },
      {
        id: "n2",
        type: "step",
        position: { x: 320, y: 10 },
        data: {
          label: "Vendor Search",
          model: "claude-3.5",
          param: 65,
          correctness: 65,
          keywords: "",
          count: 20,
          nodeType: "vendor-search",
        },
      },
      {
        id: "n3",
        type: "step",
        position: { x: 620, y: 60 },
        data: {
          label: "Shortlisting",
          model: "gpt-4.1-mini",
          param: 55,
          correctness: 55,
          keywords: "",
          count: 15,
          nodeType: "shortlisting",
        },
      },
      {
        id: "n4",
        type: "step",
        position: { x: 900, y: 35 },
        data: {
          label: "Weighting & Sorting",
          model: "reranker-v2",
          param: 70,
          correctness: 70,
          keywords: "",
          count: 5,
          weights: { "price": 2, "rating": 1, "delivery": 1.5 },
          nodeType: "weighting",
        },
      },
      {
        id: "n5",
        type: "step",
        position: { x: 1180, y: 35 },
        data: {
          label: "Output",
          model: "final-output",
          param: 100,
          correctness: 100,
          keywords: "",
          count: 1,
          nodeType: "output",
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
      { id: "e4-5", source: "n4", target: "n5" },
    ],
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const updateNodeParam = useCallback(
    (id: string, param: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const d = { ...(n.data as StepData), param };
          const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count, nodeType: d.nodeType });
          const newData = { ...d, correctness: m.correctness } as StepData;
          onStepChange?.(id, { label: newData.label, param: newData.param, correctness: newData.correctness });
          return { ...n, data: newData } as Node<StepData>;
        })
      );
    },
    [onStepChange, setNodes]
  );

  const updateNodeFields = useCallback(
    (id: string, fields: Partial<Pick<StepData, "keywords" | "count" | "param" | "weights" | "vendors" | "searchResults">>) => {
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id !== id) return n;
          const oldData = n.data as StepData;
          const d = { ...oldData, ...fields };
          const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count, nodeType: d.nodeType, weights: d.weights });
          const newData = { ...d, correctness: m.correctness } as StepData;
          onStepChange?.(id, { label: newData.label, param: newData.param, correctness: newData.correctness });
          return { ...n, data: newData } as Node<StepData>;
        });
        
        // Update time data
        const timeData = updatedNodes.map((n) => {
          const data = n.data as StepData;
          const m = computeMetrics({ param: data.param, keywords: data.keywords, count: data.count, nodeType: data.nodeType, weights: data.weights });
          return {
            stepId: n.id,
            stepName: data.label,
            timeTaken: m.timeTaken || 0,
            timestamp: new Date().toLocaleTimeString()
          };
        });
        onTimeDataUpdate?.(timeData);
        
        return updatedNodes;
      });
    },
    [onStepChange, setNodes, onTimeDataUpdate]
  );

  const saveNodeChanges = useCallback((id: string, fields: Partial<Pick<StepData, "keywords" | "count" | "param" | "weights" | "vendors" | "searchResults">>) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    
    const oldData = node.data as StepData;
    
    // Track changes for history only when saving
    Object.entries(fields).forEach(([field, newValue]) => {
      const oldValue = oldData[field as keyof StepData];
      if (oldValue !== newValue && typeof oldValue !== 'function' && typeof newValue !== 'function') {
        if (field === 'weights') {
          // Special handling for weights object
          const oldWeights = oldValue as Record<string, number> || {};
          const newWeights = newValue as Record<string, number> || {};
          const oldWeightStr = JSON.stringify(oldWeights);
          const newWeightStr = JSON.stringify(newWeights);
          if (oldWeightStr !== newWeightStr) {
            addHistoryEntry(id, oldData.label, field, oldWeightStr, newWeightStr);
          }
        } else if (field === 'vendors') {
          // Special handling for vendors array
          const oldVendors = oldValue as Vendor[] || [];
          const newVendors = newValue as Vendor[] || [];
          addHistoryEntry(id, oldData.label, field, oldVendors.length, newVendors.length);
        } else {
          addHistoryEntry(id, oldData.label, field, oldValue as string | number, newValue as string | number);
        }
      }
    });
    
    // Update the node with the new data
    updateNodeFields(id, fields);
  }, [nodes, updateNodeFields, addHistoryEntry]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<StepData>>({});

  const handleEditStart = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setEditingId(nodeId);
      setEditingData({
        keywords: node.data.keywords,
        count: node.data.count,
        param: node.data.param,
        weights: node.data.weights || {}
      });
    }
  }, [nodes]);

  const handleEditSave = useCallback(() => {
    if (editingId && editingData) {
      // Filter out undefined values and ensure weights is properly handled
      const fieldsToUpdate: Partial<StepData> = {};
      if (editingData.keywords !== undefined) fieldsToUpdate.keywords = editingData.keywords;
      if (editingData.count !== undefined) fieldsToUpdate.count = editingData.count;
      if (editingData.param !== undefined) fieldsToUpdate.param = editingData.param;
      if (editingData.weights !== undefined) fieldsToUpdate.weights = editingData.weights;
      
      saveNodeChanges(editingId, fieldsToUpdate);
      setEditingId(null);
      setEditingData({});
    }
  }, [editingId, editingData, saveNodeChanges]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditingData({});
  }, []);

  // Inject handlers into node data so StepNode can call them
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...(n.data as StepData),
          onChange: (v: number) => updateNodeParam(n.id, v),
          onEdit: () => handleEditStart(n.id),
        },
      })),
    [nodes, updateNodeParam, handleEditStart]
  );

  // Initialize nodes on first prompt
  useEffect(() => {
    if (!chatQuery || isInitialized) return;
    
    // Initialize nodes and edges for the first time
    setNodes(initialNodes);
    setEdges(initialEdges);
    setIsInitialized(true);
    
    // Update the prompt node with the query
    setTimeout(() => {
      updateNodeFields("n1", { keywords: chatQuery });
      
      // Propagate to next node and update time data
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id !== "n2") return n;
          const d = { ...(n.data as StepData) };
          const d2 = { ...d, keywords: chatQuery, param: d.param };
          const m = computeMetrics({ param: d2.param, keywords: d2.keywords, count: d2.count, nodeType: d2.nodeType, weights: d2.weights });
          const newData = { ...d2, correctness: m.correctness } as StepData;
          onStepChange?.("n2", { label: newData.label, param: newData.param, correctness: newData.correctness });
          return { ...n, data: newData } as Node<StepData>;
        });
        
        // Update time data
        const timeData = updatedNodes.map((n) => {
          const data = n.data as StepData;
          const m = computeMetrics({ param: data.param, keywords: data.keywords, count: data.count, nodeType: data.nodeType, weights: data.weights });
          return {
            stepId: n.id,
            stepName: data.label,
            timeTaken: m.timeTaken || 0,
            timestamp: new Date().toLocaleTimeString()
          };
        });
        onTimeDataUpdate?.(timeData);
        
        return updatedNodes;
      });
      
      // Emit change for Chat node
      const n1 = initialNodes.find((n) => n.id === "n1") as Node<StepData> | undefined;
      if (n1) {
        const d = { ...n1.data, keywords: chatQuery } as StepData;
        const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count, nodeType: d.nodeType, weights: d.weights });
        onStepChange?.("n1", { label: d.label, param: d.param, correctness: m.correctness });
      }
    }, 100); // Small delay to ensure nodes are initialized
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatQuery, chatVersion, isInitialized]);

  // Handle subsequent prompt updates
  useEffect(() => {
    if (!chatQuery || !isInitialized) return;
    
    // Update existing nodes
    updateNodeFields("n1", { keywords: chatQuery });
    
    // Propagate to next node
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== "n2") return n;
        const d = { ...(n.data as StepData) };
        const d2 = { ...d, keywords: chatQuery, param: d.param };
        const m = computeMetrics({ param: d2.param, keywords: d2.keywords, count: d2.count, nodeType: d2.nodeType, weights: d2.weights });
        const newData = { ...d2, correctness: m.correctness } as StepData;
        onStepChange?.("n2", { label: newData.label, param: newData.param, correctness: newData.correctness });
        return { ...n, data: newData } as Node<StepData>;
      })
    );
    
    // Emit change for Chat node
    const n1 = nodes.find((n) => n.id === "n1") as Node<StepData> | undefined;
    if (n1) {
      const d = { ...n1.data, keywords: chatQuery } as StepData;
      const m = computeMetrics({ param: d.param, keywords: d.keywords, count: d.count, nodeType: d.nodeType, weights: d.weights });
      onStepChange?.("n1", { label: d.label, param: d.param, correctness: m.correctness });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatQuery, chatVersion, isInitialized]);

  // Reset canvas when chatQuery is cleared
  useEffect(() => {
    if (chatQuery === undefined && isInitialized) {
      setNodes([]);
      setEdges([]);
      setIsInitialized(false);
      onReset?.();
    }
  }, [chatQuery, isInitialized, onReset]);

      return (
      <div className="h-[380px] rounded-xl border bg-card/60 backdrop-blur-sm ambient-surface relative">
        {!isInitialized ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl opacity-20">🔍</div>
              <div className="text-lg font-medium text-muted-foreground">
                Enter a prompt to start the workflow
              </div>
              <div className="text-sm text-muted-foreground">
                Type your query above and click "Send" to visualize the AI decision process
              </div>
            </div>
          </div>
        ) : (
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
        )}

      <Sheet open={!!editingId} onOpenChange={(open) => !open && handleEditCancel()}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px]">
          {editingId && (
            <div className="space-y-4">
              {(() => {
                const n = nodes.find((x) => x.id === editingId) as Node<StepData> | undefined;
                if (!n) return null;
                const d = n.data as StepData;
                
                // Special summary view for output node
                if (d.nodeType === 'output') {
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-bold">SUMMARY</div>
                        <div className="text-xs text-muted-foreground">Final Analysis Report</div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-sm mb-2">Basic Information:</h3>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div>• User queried: "{d.keywords || 'No query provided'}"</div>
                            <div>• Number of nodes in workflow: 5 nodes</div>
                            <div>• End-to-end runtime: {Math.round(Math.random() * 3 + 1.5).toFixed(1)} seconds</div>
                            <div>• Data volume processed: {d.vendors ? `${d.vendors.length * 50 + Math.floor(Math.random() * 200)}` : '1,247'} files/records</div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-sm mb-2">Results Analysis:</h3>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            {d.vendors && d.vendors.length > 0 ? (
                              <>
                                <div>• Results selected: {d.vendors.slice(0, 3).map(v => v.vendor_name).join(', ')}</div>
                                <div>• Total vendors processed: {d.vendors.length}</div>
                                <div>• Average rating: {(d.vendors.reduce((sum, v) => sum + v.average_rating, 0) / d.vendors.length).toFixed(1)}/5.0</div>
                              </>
                            ) : (
                              <>
                                <div>• Results selected: No vendors found yet</div>
                                <div>• Results rejected: None (no search performed)</div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-sm mb-2">Compliance Analysis:</h3>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            {d.vendors && d.vendors.length > 0 ? (
                              d.vendors.slice(0, 5).map((vendor, index) => {
                                const isCompliant = !vendor.compliance_violations || vendor.compliance_violations.length === 0;
                                const carbonScore = vendor.carbon_score || 0;
                                return (
                                  <div key={index}>
                                    • {vendor.vendor_name}: {isCompliant ? '✅' : '❌'} {isCompliant ? 'Compliant' : 'Non-compliant'} 
                                    (Carbon: {carbonScore}/100, Rating: {vendor.average_rating})
                                  </div>
                                );
                              })
                            ) : (
                              <>
                                <div>• No vendors analyzed yet</div>
                                <div>• Perform a vendor search to see compliance analysis</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-2">
                        <Button variant="outline" onClick={handleEditCancel}>Close</Button>
                      </div>
                    </div>
                  );
                }
                
                // Default edit view for other nodes
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium">{d.label}</div>
                      <div className="text-xs text-muted-foreground">Model: {d.model}</div>
                    </div>
                    
                    {d.nodeType === 'vendor-search' ? (
                      // Special edit view for vendor search node
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="kw">Search Keywords</Label>
                          <Input 
                            id="kw" 
                            value={editingData.keywords || ''} 
                            placeholder="e.g., paint, Wyoming, eco-friendly" 
                            onChange={(e) => setEditingData(prev => ({ ...prev, keywords: e.target.value }))} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnt">Max results</Label>
                          <Input 
                            id="cnt" 
                            type="number" 
                            min={1} 
                            max={50} 
                            value={editingData.count || 0} 
                            onChange={(e) => setEditingData(prev => ({ ...prev, count: Number(e.target.value || 0) }))} 
                          />
                        </div>
                        
                        {/* Vendor Search Component */}
                        <div className="space-y-2">
                          <Label>Live Vendor Search</Label>
                          <div className="border rounded-lg p-3 bg-muted/20">
                            <VendorSearch 
                              keywords={editingData.keywords || ''}
                              maxResults={editingData.count || 10}
                              onVendorsFound={(vendors) => {
                                setFoundVendors(vendors);
                                // Update the current node with found vendors
                                updateNodeFields(editingId!, { 
                                  vendors: vendors,
                                  searchResults: vendors.length 
                                });
                                // Also update the output node with the vendor data
                                updateNodeFields("n5", { 
                                  vendors: vendors,
                                  searchResults: vendors.length 
                                });
                                // Notify parent component
                                onVendorsFound?.(vendors);
                              }}
                              onSearchComplete={(count) => {
                                updateNodeFields(editingId!, { searchResults: count });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : d.nodeType === 'weighting' ? (
                      // Special edit view for weighting node
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Weights Configuration</Label>
                          <div className="text-xs text-muted-foreground mb-2">
                            Configure weights for different criteria (e.g., price: 2, rating: 1)
                          </div>
                          <div className="space-y-2">
                            {Object.entries(editingData.weights || {}).filter(([key, value]) => key && typeof value === 'number').map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <Input
                                  value={key}
                                  className="flex-1"
                                  placeholder="Criteria name"
                                  onChange={(e) => {
                                    const currentWeights = editingData.weights || {};
                                    const newWeights = { ...currentWeights };
                                    delete newWeights[key];
                                    newWeights[e.target.value] = value;
                                    setEditingData(prev => ({ ...prev, weights: newWeights }));
                                  }}
                                />
                                <Input
                                  type="number"
                                  value={value}
                                  className="w-20"
                                  placeholder="Weight"
                                  onChange={(e) => {
                                    const currentWeights = editingData.weights || {};
                                    const newWeights = { ...currentWeights };
                                    newWeights[key] = Number(e.target.value) || 0;
                                    setEditingData(prev => ({ ...prev, weights: newWeights }));
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentWeights = editingData.weights || {};
                                    const newWeights = { ...currentWeights };
                                    delete newWeights[key];
                                    setEditingData(prev => ({ ...prev, weights: newWeights }));
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentWeights = editingData.weights || {};
                                const newWeights = { ...currentWeights, "new_criteria": 1 };
                                setEditingData(prev => ({ ...prev, weights: newWeights }));
                              }}
                            >
                              + Add Criteria
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : d.nodeType === 'shortlisting' ? (
                      // Special edit view for shortlisting node
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Shortlisting Criteria</Label>
                          <div className="text-xs text-muted-foreground mb-2">
                            Configure shortlisting parameters for vendor selection
                          </div>
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor="shortlist-count">Max candidates to shortlist</Label>
                              <Input 
                                id="shortlist-count" 
                                type="number" 
                                min={1} 
                                max={50} 
                                value={editingData.count || 5} 
                                onChange={(e) => setEditingData(prev => ({ ...prev, count: Number(e.target.value || 5) }))} 
                              />
                            </div>
                            <div>
                              <Label htmlFor="shortlist-keywords">Filter keywords</Label>
                              <Input 
                                id="shortlist-keywords" 
                                value={editingData.keywords || ''} 
                                placeholder="e.g., compliant, eco-friendly, local" 
                                onChange={(e) => setEditingData(prev => ({ ...prev, keywords: e.target.value }))} 
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Show current vendors and allow shortlisting */}
                        {foundVendors.length > 0 && (
                          <div className="space-y-2">
                            <Label>Available Vendors ({foundVendors.length})</Label>
                            <div className="text-xs text-muted-foreground mb-2">
                              Select vendors to shortlist for final output
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-2">
                              {foundVendors.slice(0, editingData.count || 5).map((vendor, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border rounded">
                                  <div className="text-xs">
                                    <div className="font-medium">{vendor.vendor_name}</div>
                                    <div className="text-muted-foreground">Rating: {vendor.average_rating} | Price: {vendor.pricing}</div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      // Update output node with shortlisted vendors
                                      const shortlistedVendors = foundVendors.slice(0, editingData.count || 5);
                                      updateNodeFields("n5", { 
                                        vendors: shortlistedVendors,
                                        searchResults: shortlistedVendors.length 
                                      });
                                      // Update current node
                                      updateNodeFields(editingId!, { 
                                        vendors: shortlistedVendors,
                                        searchResults: shortlistedVendors.length 
                                      });
                                    }}
                                  >
                                    Shortlist
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Standard edit view for other nodes
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="kw">Keywords</Label>
                          <Input 
                            id="kw" 
                            value={editingData.keywords || ''} 
                            placeholder="e.g., logistics, eco-friendly, express" 
                            onChange={(e) => setEditingData(prev => ({ ...prev, keywords: e.target.value }))} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnt">Max candidates</Label>
                          <Input 
                            id="cnt" 
                            type="number" 
                            min={1} 
                            max={999} 
                            value={editingData.count || 0} 
                            onChange={(e) => setEditingData(prev => ({ ...prev, count: Number(e.target.value || 0) }))} 
                          />
                        </div>
                      </>
                    )}

                    <div className="pt-2 flex gap-2">
                      <Button variant="outline" onClick={handleEditCancel}>Cancel</Button>
                      <Button onClick={handleEditSave}>Save Changes</Button>
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
