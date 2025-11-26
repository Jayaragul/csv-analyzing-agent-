import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ChartData } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface Props {
  data: ChartData;
}

const DataChart: React.FC<Props> = ({ data }) => {
  // Validate that data and data.data exist and data.data is an array
  if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) return null;

  const renderChart = () => {
    switch (data.type) {
      case 'bar':
        return (
          <BarChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={data.xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={data.yKey} fill="#3b82f6" />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={data.xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={data.yKey} stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        );
      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey={data.xKey} name={data.xKey} />
            <YAxis type="number" dataKey={data.yKey} name={data.yKey} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter name={data.title} data={data.data} fill="#8884d8" />
          </ScatterChart>
        );
      case 'pie':
        return (
          <PieChart>
             <Pie
              data={data.data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={data.yKey}
              nameKey={data.xKey}
            >
              {data.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      default:
        return <div>Unsupported chart type: {data.type}</div>;
    }
  };

  return (
    <div className="w-full h-80 bg-white p-4 rounded-lg shadow-md border border-gray-200 mt-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">{data.title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default DataChart;