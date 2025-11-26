import { Task, LineBalancingResult, Station } from '../types';

/**
 * Greedy Algorithm (Largest Candidate Rule) for Line Balancing
 */
export const solveLineBalancing = (tasks: Task[], cycleTime: number): LineBalancingResult => {
  // Safety check if tasks is not an array (e.g. bad tool output)
  const taskList = Array.isArray(tasks) ? tasks : [];
  
  const timeMap = new Map<string, number>();
  const predsMap = new Map<string, Set<string>>();
  
  taskList.forEach(t => {
    timeMap.set(t.id, t.time);
    predsMap.set(t.id, new Set(t.preds));
  });

  const assigned = new Set<string>();
  const stations: Station[] = [];
  let stationIdCounter = 1;

  while (assigned.size < taskList.length) {
    const currentStationTasks: string[] = [];
    let currentLoad = 0;

    // While we can still potentially fit tasks into this station
    let addedTask = true;
    while (addedTask) {
      addedTask = false;

      // Find available tasks: 
      // 1. Not yet assigned
      // 2. All predecessors are assigned
      const availableCandidates = taskList.filter(t => {
        if (assigned.has(t.id)) return false;
        const pSet = predsMap.get(t.id);
        if (!pSet) return true;
        for (let p of Array.from(pSet)) {
            if (!assigned.has(p)) return false;
        }
        return true;
      });

      // Sort by Time descending (Greedy strategy)
      availableCandidates.sort((a, b) => b.time - a.time);

      // Try to fit the largest candidate
      for (const candidate of availableCandidates) {
        if (currentLoad + candidate.time <= cycleTime) {
          currentStationTasks.push(candidate.id);
          currentLoad += candidate.time;
          assigned.add(candidate.id);
          addedTask = true;
          break; // Restart search for next task in this station
        }
      }
    }

    // If no tasks could be added but unassigned tasks remain, 
    // force a new station or handle "infeasible" logic if a single task > cycleTime
    if (currentStationTasks.length === 0 && assigned.size < taskList.length) {
        // Fallback: This usually means a single task is larger than cycle time.
        // For this demo, we just assign the next available one and overflow (or warn).
        const nextAvailable = taskList.filter(t => !assigned.has(t.id)).sort((a,b) => b.time - a.time)[0];
        if (nextAvailable) {
            currentStationTasks.push(nextAvailable.id);
            currentLoad += nextAvailable.time;
            assigned.add(nextAvailable.id);
        }
    }

    stations.push({
      id: stationIdCounter++,
      tasks: currentStationTasks,
      load: currentLoad,
      idle: Math.max(0, cycleTime - currentLoad)
    });
  }

  const totalTaskTime = Array.from(timeMap.values()).reduce((a, b) => a + b, 0);
  const n = stations.length;
  // Prevent division by zero
  const efficiency = n > 0 && cycleTime > 0 ? (totalTaskTime / (n * cycleTime)) * 100 : 0;
  const idleTotal = (n * cycleTime) - totalTaskTime;

  return {
    stations,
    n_stations: n,
    efficiency_percent: parseFloat(efficiency.toFixed(2)),
    idle_total_seconds: parseFloat(idleTotal.toFixed(2)),
    total_task_time_seconds: totalTaskTime,
    cycle_time: cycleTime
  };
};

export const parseCSVToTasks = (csvContent: string): Task[] => {
    const lines = csvContent.trim().split('\n');
    const tasks: Task[] = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        // Expect format: id, time, preds (semi-colon separated)
        if (parts.length >= 2) {
            const id = parts[0].trim();
            const time = parseFloat(parts[1]);
            let preds: string[] = [];
            if (parts[2] && parts[2].trim() !== '') {
                preds = parts[2].split(';').map(s => s.trim());
            }
            tasks.push({ id, time, preds });
        }
    }
    return tasks;
}