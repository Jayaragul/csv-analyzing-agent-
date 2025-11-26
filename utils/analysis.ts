
export interface ColumnSummary {
  name: string;
  type: 'numeric' | 'string';
  missing: number;
  stats?: {
    count: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
  };
  topValues?: { value: string, count: number }[];
  uniqueCount?: number;
}

export interface DatasetSummary {
  rowCount: number;
  columns: ColumnSummary[];
  error?: string;
}

const getBasicStats = (data: any[], key: string) => {
    const values = data.map(d => Number(d[key])).filter(n => !isNaN(n));
    if (values.length === 0) return null;
    
    values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    
    // Std Dev
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { 
        count: values.length, 
        mean: parseFloat(mean.toFixed(2)), 
        median: parseFloat(median.toFixed(2)), 
        min, 
        max, 
        stdDev: parseFloat(stdDev.toFixed(2)) 
    };
};

// Helper to handle NaN/Infinity for JSON serialization
const safeFloat = (num: number): number | null => {
    if (!Number.isFinite(num)) return null;
    return num;
};

export const generateDatasetSummary = (csvText: string): DatasetSummary => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { rowCount: 0, columns: [], error: "Empty or invalid CSV" };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => {
            let val = values[i]?.trim();
            // Try to convert to number if possible
            if (val && !isNaN(Number(val))) {
                // Keep string if it looks like an ID but is numeric? 
                // For summary, we treat as number to give stats.
            }
            obj[h] = val;
        });
        return obj;
    });

    const columns: ColumnSummary[] = [];

    headers.forEach(header => {
        const rawValues = rows.map(r => r[header]);
        const nonNullValues = rawValues.filter(v => v !== undefined && v !== '');
        
        const numericCount = nonNullValues.filter(v => !isNaN(Number(v))).length;
        const isNumeric = nonNullValues.length > 0 && (numericCount / nonNullValues.length) > 0.8;
        
        const colSummary: ColumnSummary = {
            name: header,
            type: isNumeric ? 'numeric' : 'string',
            missing: rows.length - nonNullValues.length
        };

        if (isNumeric) {
            const stats = getBasicStats(rows, header);
            if (stats) {
                // Sanitize stats for JSON
                colSummary.stats = {
                    count: stats.count,
                    mean: safeFloat(stats.mean) ?? 0,
                    median: safeFloat(stats.median) ?? 0,
                    min: safeFloat(stats.min) ?? 0,
                    max: safeFloat(stats.max) ?? 0,
                    stdDev: safeFloat(stats.stdDev) ?? 0
                };
            }
        } else {
             const counts: Record<string, number> = {};
             nonNullValues.forEach(v => counts[v] = (counts[v] || 0) + 1);
             const top = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([value, count]) => ({ value, count }));
             
             colSummary.topValues = top;
             colSummary.uniqueCount = Object.keys(counts).length;
        }
        columns.push(colSummary);
    });

    return {
        rowCount: rows.length,
        columns
    };
};

/**
 * Extracts raw data for visualization from the CSV string.
 * This ensures the chart gets the FULL dataset, not just what the LLM hallucinates.
 */
export const getRawDataForChart = (csvText: string, xKey: string, yKey: string): any[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const xIndex = headers.indexOf(xKey);
    const yIndex = headers.indexOf(yKey);

    if (xIndex === -1 || yIndex === -1) return [];

    const data: any[] = [];
    
    // Limit to 2000 points for UI performance if needed, or take all if React can handle it.
    // Taking first 2000 for safety, but can be adjusted.
    const limit = 2000; 

    for (let i = 1; i < lines.length && i < limit; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        // Handle basic CSV splitting (ignoring complex quotes for speed/simplicity)
        const parts = line.split(','); 
        
        const xValRaw = parts[xIndex]?.trim();
        const yValRaw = parts[yIndex]?.trim();

        if (xValRaw !== undefined && yValRaw !== undefined) {
             const point: any = {};
             
             // Auto-convert Y to number
             const yNum = parseFloat(yValRaw);
             point[yKey] = isNaN(yNum) ? yValRaw : yNum;

             // Auto-convert X to number if it looks like one, else string
             const xNum = parseFloat(xValRaw);
             point[xKey] = isNaN(xNum) ? xValRaw : xNum;

             data.push(point);
        }
    }
    return data;
};
