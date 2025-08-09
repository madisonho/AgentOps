import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import '../ui/theme.css';
import axios from 'axios';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { DemoPage } from './pages/DemoPage';
import { Box } from '@mui/material';

export type TimelineEvent = {
  type: string
  run_id: string
  timestamp_ms: number
  step_id?: string
  step_name?: string
  [key: string]: any
}

export type Step = {
  step_id: string
  step_name: string
  parent_id?: string
  started_ms: number
  finished_ms?: number
  status: string
}

// Navigation component
const Navigation: React.FC = () => (
  <nav style={{
    backgroundColor: 'var(--bg-color)',
    padding: '1rem',
    marginBottom: '2rem',
    borderBottom: '1px solid var(--border-color)'
  }}>
    <Link to="/" style={{ marginRight: '1rem', color: 'var(--text-color)' }}>Home</Link>
    <Link to="/demo" style={{ color: 'var(--text-color)' }}>Vendor Selection Demo</Link>
  </nav>
);

// Main App component with routing
// Main App component with routing
export const App: React.FC = () => {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <Navigation />
        <Routes>
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/" element={<FlightRecorderApp />} />
        </Routes>
      </div>
    </Router>
  );
};

// Original Flight Recorder App as a separate component
const FlightRecorderApp: React.FC = () => {
  const [runId, setRunId] = useState<string>('')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [playing, setPlaying] = useState(false)
  const [dark, setDark] = useState<boolean>(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [pointer, setPointer] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [scenarioText, setScenarioText] = useState<string>('')
  const [detail, setDetail] = useState<{prompt?: string, output?: string, latency_ms?: number, tokens?: any}>({})
  const [rf, setRf] = useState<ReactFlowInstance | null>(null)

  const nodes: Node[] = useMemo(() => steps.map((s, idx) => ({
    id: s.step_id,
    position: { x: idx * 220, y: 100 },
    data: { label: `${idx + 1}. ${s.step_name}` },
    style: {
      background: s.status==='success' ? 'var(--bubble-success)': s.status==='failed' ? 'var(--bubble-failed)': 'var(--bubble-default)',
      color: 'var(--bubble-text)'
    },
  })), [steps])

  const edges: Edge[] = useMemo(() => {
    const explicit = steps
      .filter(s => s.parent_id)
      .map(s => ({ id: `${s.parent_id}->${s.step_id}`, source: s.parent_id!, target: s.step_id }));
    if (explicit.length > 0) return explicit;
    // fallback to sequential edges when no parent_id data
    return steps.slice(1).map((s, idx) => ({
      id: `${steps[idx].step_id}->${s.step_id}`,
      source: steps[idx].step_id,
      target: s.step_id,
    }));
  }, [steps])

  async function fetchTimeline(rid: string) {
    const res = await axios.get(`/api/runs/${rid}/timeline`)
    setEvents(res.data.timeline)
    setSteps(res.data.steps)
    // after state update, fit view on next tick
    setTimeout(() => rf?.fitView({ padding: 0.2 }), 0)

    // Try to derive the scenario/user input from the first model.call prompt
    const firstModel = (res.data.timeline as TimelineEvent[]).find(e => e.type === 'model.call')
    if (firstModel?.prompt_artifact_id) {
      const text = await fetchArtifactText(firstModel.prompt_artifact_id)
      try {
        const msgs = JSON.parse(text)
        const userMsg = Array.isArray(msgs) ? [...msgs].reverse().find((m:any)=>m.role==='user') : null
        setScenarioText(userMsg?.content || text.slice(0, 400))
      } catch {
        setScenarioText(text.slice(0, 400))
      }
    }
  }

  async function startDemoRun() {
    // call local python script manually, or ask user to run it; here we assume run already exists
    const rid = prompt('Enter run_id (after running python script):') || ''
    setRunId(rid)
    if (rid) await fetchTimeline(rid)
  }

  useEffect(() => {
    let t: number | undefined
    if (playing && pointer < events.length) {
      t = window.setTimeout(() => setPointer((p) => p + 1), 800 / speed)
    }
    return () => window.clearTimeout(t)
  }, [playing, pointer, events.length, speed])

  const activeStepId = events[pointer]?.step_id
  useEffect(()=>{ if (activeStepId) setSelectedStepId(activeStepId) }, [activeStepId])

  // Load detail for the selected step: prompt/output/latency/tokens
  useEffect(()=>{
    (async () => {
      if (!selectedStepId) { setDetail({}); return }
      const modelEvent = [...events].reverse().find(e => e.type==='model.call' && e.step_id===selectedStepId)
      if (!modelEvent) { setDetail({}); return }
      const d:any = { latency_ms: modelEvent.latency_ms, tokens: modelEvent.tokens }
      if (modelEvent.prompt_artifact_id) d.prompt = await fetchArtifactText(modelEvent.prompt_artifact_id)
      if (modelEvent.output_artifact_id) d.output = await fetchArtifactText(modelEvent.output_artifact_id)
      setDetail(d)
    })()
  }, [selectedStepId, events])

  async function fetchArtifactText(artifactId: string): Promise<string> {
    const r = await axios.get(`/api/artifacts/${artifactId}`, { responseType: 'arraybuffer' })
    // decode as utf-8; if it is JSON bytes, this will still be fine
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(new Uint8Array(r.data))
  }

  return (
    <div data-theme={dark ? 'dark':'light'} style={{ height: '100vh', display: 'grid', gridTemplateRows: '72px 1fr 260px' }}>
      {/* Top bar: Scenario and run info */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding:'8px 16px', borderBottom:'1px solid #e5e7eb', background:'#fafafa' }}>
        <strong>Scenario:</strong>
        <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{scenarioText || '(derived from first prompt)'}</span>
        <span style={{ marginLeft:'auto', opacity:0.7 }}>Run: {runId || '(load a run)'}</span>
      </div>

      {/* Middle: Graph + Step Detail */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', minHeight:0 }}>
        <div>
          <ReactFlow
            onInit={setRf} 
            nodes={nodes.map((n) => ({ 
              ...n, 
              style: {
              ...(n.style||{}),
              ...(n.id===activeStepId ? { boxShadow:'0 0 0 3px #22c55e' }: {})
            },
            }))}
            edges={edges}
            onNodeClick={(_, node) => setSelectedStepId(node.id)}
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>
        <aside style={{ borderLeft:'1px solid #e5e7eb', padding:12, overflow:'auto' }}>
          <h3 style={{ margin:'4px 0 8px 0' }}>Step Details</h3>
          {!selectedStepId && <div>Select a node</div>}
          {selectedStepId && (
            <div>
              <div style={{ marginBottom:8 }}>
                <strong>Step:</strong> {steps.find(s=>s.step_id===selectedStepId)?.step_name}
              </div>
              <div style={{ marginBottom:8 }}>
                <strong>Status:</strong> {steps.find(s=>s.step_id===selectedStepId)?.status}
              </div>
              {detail.latency_ms!=null && (
                <div style={{ marginBottom:8 }}>
                  <strong>Latency:</strong> {detail.latency_ms} ms
                </div>
              )}
              {detail.tokens && (
                <div style={{ marginBottom:8 }}>
                  <strong>Tokens:</strong> <code>{JSON.stringify(detail.tokens)}</code>
                </div>
              )}
              <div>
                <strong>Prompt</strong>
                <pre style={{ whiteSpace:'pre-wrap', background:'#f8fafc', padding:8, borderRadius:6, maxHeight:120, overflow:'auto' }}>{(detail.prompt||'').toString()}</pre>
              </div>
              <div>
                <strong>Output</strong>
                <pre style={{ whiteSpace:'pre-wrap', background:'#f8fafc', padding:8, borderRadius:6, maxHeight:160, overflow:'auto' }}>{(detail.output||'').toString()}</pre>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom: Timeline + Playback */}
      <div style={{ padding: 12, borderTop: '1px solid #ddd', overflow: 'auto', background:'#fff' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom:8 }}>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => setPointer(0)}>Reset</button>
          <label>Speed <input type="number" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} /></label>
          <button onClick={startDemoRun}>Load Run</button>
          <button onClick={()=>setDark(d=>!d)}>{dark?'Light':'Dark'} Mode</button>
          <span style={{ marginLeft: 'auto' }}>{runId && `Run: ${runId}`}</span>
        </div>
        <ol>
          {events.map((e, i) => (
            <li key={i} style={{ color: i === pointer ? '#22c55e' : undefined, cursor:'pointer' }} onClick={()=>{ if (e.step_id) setSelectedStepId(e.step_id); setPointer(i) }}>
              {new Date(e.timestamp_ms).toLocaleTimeString()} — {e.type} {e.step_name || e.step_id || ''}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

