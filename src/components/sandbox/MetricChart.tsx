import { Card } from "@/components/ui/card";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type MetricPoint = { idx: number; correctness: number };

interface MetricChartProps {
  data: MetricPoint[];
}

export function MetricChart({ data }: MetricChartProps) {
  const safeData = useMemo(() => (data.length ? data : [{ idx: 0, correctness: 0 }]), [data]);
  return (
    <Card className="p-4 h-[300px]">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">Correctness Over Time</h3>
        <p className="text-sm text-muted-foreground">Live metric as you tune node parameters</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={safeData} margin={{ right: 12, left: 0, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
          <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ stroke: "hsl(var(--brand))", strokeWidth: 1 }} />
          <Line type="monotone" dataKey="correctness" stroke={`hsl(var(--brand))`} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default MetricChart;
