import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AIFlowCanvas, type EditHistory } from "@/components/sandbox/AIFlowCanvas";
import { MetricChart, type MetricPoint } from "@/components/sandbox/MetricChart";
import { ActionTimeline, type ActionItem } from "@/components/sandbox/ActionTimeline";
import { EditHistory as EditHistoryComponent } from "@/components/sandbox/EditHistory";
import { VendorAnalytics } from "@/components/sandbox/VendorAnalytics";
import { VendorSearch } from "@/components/sandbox/VendorSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useVendorSearch, useVendorAnalytics } from "@/hooks/use-vendors";
import type { Vendor } from "@/lib/api";

const Index = () => {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [foundVendors, setFoundVendors] = useState<Vendor[]>([]);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [apiMode, setApiMode] = useState<'mock' | 'backend'>('mock');

  // Initialize API configuration and update when mode changes
  useEffect(() => {
    import('@/lib/api').then(({ API_CONFIG }) => {
      // Ensure mock data is used by default
      API_CONFIG.setUseMockData(apiMode === 'mock');
    });
  }, [apiMode]);

  // Initialize mock data mode on component mount
  useEffect(() => {
    import('@/lib/api').then(({ API_CONFIG }) => {
      API_CONFIG.setUseMockData(true);
    });
  }, []);

  // Load initial vendor data when component mounts
  useEffect(() => {
    // Trigger initial data load for analytics
    const loadInitialData = async () => {
      try {
        const { VendorAPI } = await import('@/lib/api');
        // This will populate the analytics with mock data
        await VendorAPI.getVendorAnalytics();
        
        // Also load some sample vendors to demonstrate the search functionality
        const sampleVendors = await VendorAPI.searchVendors({ limit: 5 });
        if (sampleVendors.vendors.length > 0) {
          setFoundVendors(sampleVendors.vendors);
        }
      } catch (error) {
        console.log('Initial data load completed');
      }
    };
    loadInitialData();
  }, []);
  const tick = useRef(1);
  const [chatText, setChatText] = useState("");
  const [chatQuery, setChatQuery] = useState<string | undefined>(undefined);
  const [chatVersion, setChatVersion] = useState(0);

  // Test backend connection
  useEffect(() => {
    const testBackend = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/health');
        if (response.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (error) {
        setBackendStatus('error');
      }
    };
    testBackend();
  }, []);

  const handleStepChange = useCallback((id: string, payload: { label: string; param: number; correctness: number }) => {
    const ts = new Date().toLocaleTimeString();
    setActions((a) => [
      { id: `${Date.now()}`, ts, stepId: id.replace("n", "#"), label: `${payload.label} updated`, value: payload.correctness },
      ...a,
    ].slice(0, 40));
    toast({ title: "Step updated", description: `${payload.label}: ${Math.round(payload.correctness)}%` });
  }, []);

  const handleInspect = useCallback((info: { id: string; label: string; param: number; correctness: number }) => {
    toast({ title: `Inspect • ${info.label}`, description: `Param: ${info.param} | Correctness: ${Math.round(info.correctness)}%` });
  }, []);

  const reset = useCallback(() => {
    setMetrics([]);
    setActions([]);
    setEditHistory([]);
    setFoundVendors([]);
    setChatQuery(undefined);
    setChatText("");
    tick.current = 1;
  }, []);

  const submitChat = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatText.trim()) return;
    setChatQuery(chatText.trim());
    setChatVersion((v) => v + 1);
  }, [chatText]);

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--pointer-x", `${e.clientX - rect.left}px`);
    target.style.setProperty("--pointer-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <main className="min-h-screen py-10">
      <div className="container">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">AI Decision Trace Sandbox</h1>
            <p className="text-muted-foreground mt-1">
              Visualize, inspect, and replay AI decision-making steps with {apiMode === 'mock' ? 'mock' : 'real'} vendor data.
              {apiMode === 'mock' && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Using Mock Data
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant={backendStatus === 'connected' ? 'default' : 'destructive'}
                className="text-xs"
              >
                {backendStatus === 'connected' ? '✅ Backend Connected' : 
                 backendStatus === 'error' ? '❌ Backend Disconnected' : '⏳ Checking...'}
              </Badge>
                          <Button
              variant={apiMode === 'mock' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setApiMode(apiMode === 'mock' ? 'backend' : 'mock')}
              disabled={backendStatus !== 'connected'}
            >
              {apiMode === 'mock' ? '🎭 Mock Data (Active)' : '🔌 Real Backend'}
            </Button>
            </div>
            <Button variant="hero" onClick={reset}>Reset sandbox</Button>
          </div>
        </header>

        <section className="mb-6" onMouseMove={onPointerMove}>
          <form className="mb-3 flex items-center gap-2" onSubmit={submitChat} aria-label="Ask a question">
            <Input
              placeholder={apiMode === 'mock' ? "Try: 'Find paint vendors in Wyoming' or 'Search for eco-friendly suppliers'" : "Ask a question to start the flow…"}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <Button type="submit">Send</Button>
          </form>
          {apiMode === 'mock' && (
            <div className="text-xs text-muted-foreground mb-3">
              💡 Try searching for: "paint vendors", "Wyoming suppliers", "eco-friendly", or "compliant vendors"
            </div>
          )}
          <AIFlowCanvas 
            onStepChange={handleStepChange} 
            onInspect={handleInspect} 
            onHistoryUpdate={setEditHistory}
            onTimeDataUpdate={setMetrics}
            onVendorsFound={setFoundVendors}
            onReset={() => {
              setMetrics([]);
              setActions([]);
              setEditHistory([]);
              setFoundVendors([]);
            }}
            chatQuery={chatQuery} 
            chatVersion={chatVersion} 
          />
        </section>

        <section className="mt-6">
          <Tabs defaultValue="workflow" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="workflow" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Workflow Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MetricChart data={metrics} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Action Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActionTimeline items={actions} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="metrics" className="mt-4">
              <MetricChart data={metrics} />
            </TabsContent>
            
            <TabsContent value="timeline" className="mt-4">
              <ActionTimeline items={actions} />
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              <EditHistoryComponent history={editHistory} />
            </TabsContent>
            
            <TabsContent value="analytics" className="mt-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Analytics Dashboard</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Real-time insights from {apiMode === 'backend' ? 'backend API' : 'mock data'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <VendorAnalytics />
                  </CardContent>
                </Card>
                
                {foundVendors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Found Vendors ({foundVendors.length})</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Vendors discovered through the AI workflow
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto">
                        <VendorSearch 
                          keywords=""
                          maxResults={10}
                          showCompliance={true}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <footer className="mt-10">
          <Card className="p-4 text-sm text-muted-foreground">
            Tip: Adjust node parameters above to see correctness evolve in the chart and actions populate in the timeline.
          </Card>
        </footer>
      </div>
    </main>
  );
};

export default Index;
