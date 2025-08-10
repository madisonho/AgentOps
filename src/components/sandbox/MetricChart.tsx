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

export type MetricPoint = { 
  stepId: string; 
  stepName: string; 
  timeTaken: number; 
  timestamp: string;
};

interface MetricChartProps {
  data: MetricPoint[];
}

export function MetricChart({ data }: MetricChartProps) {
  const safeData = useMemo(() => (data.length ? data : []), [data]);
  
  return (
    <Card className="p-4 h-[300px]">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">Step Execution Time</h3>
        <p className="text-sm text-muted-foreground">Time taken for each workflow step</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={safeData} margin={{ right: 12, left: 0, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
          <XAxis 
            dataKey="stepName" 
            tick={{ fontSize: 12 }} 
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 'dataMax + 1']} 
            tick={{ fontSize: 12 }}
            label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            cursor={{ stroke: "hsl(var(--brand))", strokeWidth: 1 }}
            formatter={(value: number) => [`${value.toFixed(2)}s`, 'Time']}
            labelFormatter={(label) => `Step: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="timeTaken" 
            stroke={`hsl(var(--brand))`} 
            strokeWidth={2} 
            dot={{ fill: "hsl(var(--brand))", strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default MetricChart;
