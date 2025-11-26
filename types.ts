export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  isToolOutput?: boolean;
  chartData?: ChartData; // For inline chart rendering
}

export interface Task {
  id: string;
  time: number;
  preds: string[]; // List of predecessor IDs
}

export interface Station {
  id: number;
  tasks: string[];
  load: number;
  idle: number;
}

export interface LineBalancingResult {
  stations: Station[];
  n_stations: number;
  efficiency_percent: number;
  idle_total_seconds: number;
  total_task_time_seconds: number;
  cycle_time: number;
}

export interface ChartData {
  title: string;
  type: 'bar' | 'line' | 'scatter' | 'pie';
  data: any[];
  xKey: string;
  yKey: string;
}

export interface ToolCallPayload {
  name: string;
  args: any;
}