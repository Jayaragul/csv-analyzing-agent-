import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

// Define the tools
const solveLineBalancingTool: FunctionDeclaration = {
  name: 'solve_line_balancing',
  description: 'Solves a line balancing problem given tasks and a cycle time. Returns optimal station assignments.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                time: { type: Type.NUMBER },
                preds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['id', 'time']
        },
        description: 'List of tasks with id, time (seconds), and list of predecessor IDs.'
      },
      cycle_time: {
        type: Type.NUMBER,
        description: 'The maximum time available at each workstation (seconds).'
      }
    },
    required: ['tasks', 'cycle_time']
  }
};

const plotDataTool: FunctionDeclaration = {
  name: 'plot_data',
  description: 'Generates a visualization chart. You specify the columns (xKey, yKey) and the system extracts the raw data from the file.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'scatter'] },
      xKey: { type: Type.STRING, description: 'Column name for X-axis' },
      yKey: { type: Type.STRING, description: 'Column name for Y-axis' },
      // data is optional now, as we prefer extraction from memory
      data: { 
        type: Type.ARRAY,
        items: { type: Type.OBJECT },
        description: 'Optional. Only use for small summary datasets not in the file.'
      },
    },
    required: ['title', 'type', 'xKey', 'yKey']
  }
};

const getDatasetSummaryTool: FunctionDeclaration = {
  name: 'get_dataset_summary',
  description: 'Calculates summary statistics (mean, median, std dev, unique counts, missing values) for the currently uploaded dataset. Use this tool IMMEDIATELY upon file upload to understand the data.',
  parameters: {
    type: Type.OBJECT,
    properties: {}, 
  }
};

export const createGeminiClient = (apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const getModelConfig = () => {
    return {
        systemInstruction: SYSTEM_PROMPT,
        tools: [
            {
                functionDeclarations: [solveLineBalancingTool, plotDataTool, getDatasetSummaryTool],
                googleSearch: {} 
            }
        ]
    };
};