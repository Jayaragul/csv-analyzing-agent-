import React from 'react';
import { LineBalancingResult } from '../types';
import { Layers, Activity, Clock } from 'lucide-react';

interface Props {
  result: LineBalancingResult;
}

const LineBalanceVisualizer: React.FC<Props> = ({ result }) => {
  if (!result || !result.stations) return null;

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-6 mt-4 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Line Balance Solution
        </h3>
        <div className="flex gap-4 text-sm">
            <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                Efficiency: <span className="font-bold">{result.efficiency_percent}%</span>
            </div>
            <div className="bg-orange-50 text-orange-800 px-3 py-1 rounded-full border border-orange-200">
                Cycle Time: <span className="font-bold">{result.cycle_time}s</span>
            </div>
             <div className="bg-green-50 text-green-800 px-3 py-1 rounded-full border border-green-200">
                Stations: <span className="font-bold">{result.n_stations}</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.stations.map((station) => (
          <div key={station.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50 relative overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-gray-700">Station {station.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${station.load > result.cycle_time ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                {station.load} / {result.cycle_time}s
              </span>
            </div>
            
            {/* Progress Bar for Load */}
            <div className="w-full bg-gray-200 h-2 rounded-full mb-4 overflow-hidden">
                <div 
                    className={`h-full ${station.load > result.cycle_time ? 'bg-red-500' : 'bg-blue-500'}`} 
                    style={{ width: `${Math.min(100, (station.load / result.cycle_time) * 100)}%` }}
                ></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {station.tasks.map((taskId) => (
                <div key={taskId} className="bg-white border border-gray-300 shadow-sm px-3 py-1 rounded text-sm font-medium text-gray-800 flex items-center gap-1">
                   <Activity className="w-3 h-3 text-blue-400" />
                   {taskId}
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Idle: {station.idle}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LineBalanceVisualizer;