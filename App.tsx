import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Part } from "@google/genai";
import { 
  Send, Bot, User, FileText, Loader2, BarChart2, Briefcase, 
  AlertCircle, PlayCircle, Terminal, FileSpreadsheet, File, RefreshCw, Trash2, Globe, Search, Database
} from 'lucide-react';

import { createGeminiClient, getModelConfig } from './services/gemini';
import { solveLineBalancing, parseCSVToTasks } from './utils/lineBalancing';
import { generateDatasetSummary, getRawDataForChart } from './utils/analysis';
import { parseExcelToCSV, parsePDFToText } from './utils/fileParsers';
import LineBalanceVisualizer from './components/LineBalanceVisualizer';
import DataChart from './components/DataChart';
import { Message, LineBalancingResult, ChartData, Task } from './types';
import { SAMPLE_TASKS_CSV } from './constants';

// Extension of Message type to include grounding metadata for this component
interface ExtendedMessage extends Message {
  groundingMetadata?: any;
  usageMetadata?: any;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Hello! I am DataMind. I am ready to analyze your data.\n\nPlease upload a dataset (CSV, Excel) to get started. I will list the columns and wait for your instructions on what to visualize.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // currentFileSnippet is what we show in prompt context if needed
  const [currentFileSnippet, setCurrentFileSnippet] = useState<string | null>(null);
  // fullFileContent stores the raw CSV for the analysis tools
  const [fullFileContent, setFullFileContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'pdf' | null>(null);
  
  // State for tool outputs to render in the UI
  const [activeLineBalance, setActiveLineBalance] = useState<LineBalancingResult | null>(null);

  // Logging
  const [lastUsage, setLastUsage] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleResetSession = () => {
    if (window.confirm("Are you sure you want to start a new session? All current chat history and data will be lost.")) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        content: 'Session reset. Memory cleared.\n\nI am ready for a new task. Please upload your data or ask a question.',
        timestamp: new Date()
      }]);
      setInput('');
      setCurrentFileSnippet(null);
      setFullFileContent(null);
      setFileType(null);
      setActiveLineBalance(null);
      setLastUsage(null);
    }
  };

  // Main Chat Handler
  const handleSend = async () => {
    if (!input.trim() && !currentFileSnippet) return;

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("Please set the API_KEY environment variable.");
      return;
    }

    const userMsg: ExtendedMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = createGeminiClient(apiKey);
      const config = getModelConfig();

      // Construct history for the API
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: config,
        history: history
      });

      let promptText = userMsg.content;
      
      // If a file was "uploaded" (parsed into memory), prepend context
      if (currentFileSnippet) {
        if (fileType === 'pdf') {
             promptText = `[System: The user has uploaded a PDF document. Here is the extracted text content for NLP/NER analysis:]\n${currentFileSnippet}\n\n[End of PDF Content]\n\nUser Query: ${promptText}`;
        } else {
             promptText = `[System: The user has uploaded a structured dataset (CSV/Excel). You MUST now use the 'get_dataset_summary' tool to see the columns, then list them to the user.]\n\nUser Query: ${promptText}`;
        }
        setCurrentFileSnippet(null); // Clear prompt flag after sending
      }

      let response = await chat.sendMessage({ message: promptText });
      
      // Loop to handle tool calls
      while (response.candidates?.[0]?.content?.parts?.some(p => !!p.functionCall)) {
        const toolParts = response.candidates[0].content.parts.filter(p => !!p.functionCall);
        
        // We construct an array of FunctionResponse parts to send back
        const responseParts: Part[] = [];
        
        // We accumulate any charts generated in this turn
        const newCharts: ChartData[] = [];

        for (const part of toolParts) {
           const call = part.functionCall!;
           console.log("Tool Call:", call.name, call.args);

           let functionResult: any = {};

           if (call.name === 'solve_line_balancing') {
             const args = call.args as any;
             const tasks = args.tasks as Task[];
             const cycleTime = args.cycle_time;
             // Add check in case tasks is not array
             const result = solveLineBalancing(tasks, cycleTime);
             setActiveLineBalance(result); // Update UI Sidebar
             functionResult = result;
           } else if (call.name === 'plot_data') {
             const args = call.args as any;
             
             let plotData = args.data;

             // VITAL: Inject raw data if columns are provided and we have the file
             if (fullFileContent && args.xKey && args.yKey) {
                 const raw = getRawDataForChart(fullFileContent, args.xKey, args.yKey);
                 if (raw.length > 0) {
                     plotData = raw;
                 }
             }

             if (!plotData || !Array.isArray(plotData)) {
                 functionResult = { error: "Failed to extract data for visualization. Ensure columns exist." };
             } else {
                 const chartPayload: ChartData = {
                     title: args.title,
                     type: args.type,
                     xKey: args.xKey,
                     yKey: args.yKey,
                     data: plotData
                 };
                 newCharts.push(chartPayload);
                 functionResult = { status: "success", message: "Chart rendered on frontend.", pointCount: plotData.length };
             }

           } else if (call.name === 'get_dataset_summary') {
             if (fullFileContent && fileType === 'csv') {
                const summary = generateDatasetSummary(fullFileContent);
                functionResult = summary;
             } else {
                functionResult = { error: "No structured dataset available in memory or file type is PDF." };
             }
           }

           responseParts.push({
             functionResponse: {
                name: call.name,
                response: { result: functionResult },
                id: call.id
             }
           });
        }
        
        // If we generated charts, add them as a system message in the UI so the user sees them in context
        if (newCharts.length > 0) {
            newCharts.forEach(chart => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'model',
                    content: `Generated Visualization: ${chart.title}`,
                    timestamp: new Date(),
                    chartData: chart // Attach chart data
                }]);
            });
        }

        // Send tool results back to model using sendMessage
        response = await chat.sendMessage({ message: responseParts });
      }

      const modelText = response.text || "I've processed that for you.";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const usageMetadata = response.usageMetadata;

      if (usageMetadata) {
        setLastUsage(usageMetadata);
      }
      
      const botMsg: ExtendedMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: modelText,
        timestamp: new Date(),
        groundingMetadata: groundingMetadata,
        usageMetadata: usageMetadata
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Error communicating with Gemini:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "Sorry, I encountered an error processing your request. Please check your API key and connection.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);

    try {
        let content = '';
        let detectedType: 'csv' | 'pdf' = 'csv';

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            content = await parseExcelToCSV(file);
            detectedType = 'csv';
        } else if (file.name.endsWith('.pdf')) {
            content = await parsePDFToText(file);
            detectedType = 'pdf';
        } else {
            // Default to text/csv
            content = await file.text();
            detectedType = 'csv';
        }

        setFullFileContent(content);
        setFileType(detectedType);
        
        // For prompt context
        const snippet = content.slice(0, 5000) + (content.length > 5000 ? "\n...(truncated)..." : ""); 
        setCurrentFileSnippet(snippet);
        
        if (detectedType === 'csv') {
            // Try to parse tasks immediately for preview (optional)
            const tasks = parseCSVToTasks(content);
            if (tasks.length > 0) {
                setInput(prev => prev + ` [Uploaded ${file.name}] Please analyze this task list.`);
            } else {
                setInput(prev => prev + ` [Uploaded ${file.name}] Please read this file, listing the columns and asking me what to visualize.`);
            }
        } else {
            setInput(prev => prev + ` [Uploaded ${file.name}] Please extract key entities, summarize the content, and identify sentiment.`);
        }

    } catch (err) {
        console.error("File parsing error:", err);
        alert("Failed to parse file. Please check the format.");
    } finally {
        setIsProcessingFile(false);
    }
  };

  const loadSample = () => {
    setFullFileContent(SAMPLE_TASKS_CSV);
    setCurrentFileSnippet(SAMPLE_TASKS_CSV);
    setFileType('csv');
    setInput("I uploaded sample data. Please analyze it and solve line balancing for a cycle time of 50 seconds.");
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar / Dashboard Area */}
      <div className="hidden md:flex w-full md:w-5/12 lg:w-4/12 bg-white border-r border-slate-200 flex-col shadow-lg z-10">
        <div className="p-4 border-b border-slate-200 bg-slate-100 flex justify-between items-center">
           <div className="flex items-center gap-2">
             <div className="bg-indigo-600 p-2 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
             </div>
             <div>
                <h1 className="text-xl font-bold text-slate-800">DataMind</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">AI Analytics Agent</p>
             </div>
           </div>
           
           <button 
             onClick={handleResetSession}
             className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"
             title="New Session (Clear Memory)"
           >
             <Trash2 className="w-5 h-5" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           
           <div className="text-xs text-slate-500 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
             <strong>Status:</strong> {fullFileContent ? (fileType === 'pdf' ? 'PDF Loaded' : `Dataset Loaded (${(fullFileContent.length / 1024).toFixed(1)} KB)`) : 'No Data Loaded'}
           </div>

           {/* Active Optimization Results (Keep in sidebar as it's complex state) */}
           {activeLineBalance && (
             <div className="animate-fade-in">
               <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-2">
                 <Briefcase className="w-4 h-4" /> Optimization Result
               </div>
               <LineBalanceVisualizer result={activeLineBalance} />
             </div>
           )}

           {!activeLineBalance && (
             <div className="text-center text-slate-400 mt-10 p-6 border-2 border-dashed border-slate-200 rounded-xl">
               <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-20" />
               <p>Line Balancing solutions will appear here.</p>
             </div>
           )}

           {/* Logs Section */}
           {lastUsage && (
             <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
                <div className="flex items-center gap-2 font-bold text-slate-500 mb-2">
                    <Database className="w-3 h-3" /> SESSION LOGS
                </div>
                <div className="flex justify-between">
                    <span>Prompt Tokens:</span>
                    <span>{lastUsage.promptTokenCount}</span>
                </div>
                <div className="flex justify-between">
                    <span>Response Tokens:</span>
                    <span>{lastUsage.candidatesTokenCount}</span>
                </div>
                <div className="flex justify-between pt-2 mt-2 border-t border-slate-200 font-bold">
                    <span>Total Tokens:</span>
                    <span>{lastUsage.totalTokenCount}</span>
                </div>
             </div>
           )}
        </div>
        
        {/* Sample Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Quick Actions</h4>
            <div className="flex gap-2">
                <button 
                  onClick={loadSample}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100 text-xs font-medium transition"
                >
                    <PlayCircle className="w-3 h-3 text-indigo-500" />
                    Load Sample Tasks
                </button>
                 <button 
                  onClick={handleResetSession}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded hover:bg-red-50 text-xs font-medium transition text-slate-600 hover:text-red-600"
                >
                    <RefreshCw className="w-3 h-3" />
                    Reset Session
                </button>
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
           <span className="font-semibold text-slate-700 flex items-center gap-2">
             Analytics Session
             <span className="text-xs font-normal text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" /> Web Access Enabled
             </span>
           </span>
           <div className="text-xs text-slate-400">Gemini 2.5 Flash</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'model' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                    {msg.role === 'model' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                        {msg.content}
                    </div>
                    
                    {/* Render Charts Inline */}
                    {msg.chartData && (
                        <div className="mt-4 p-2 bg-slate-50 rounded border border-slate-200 w-full h-80">
                             <DataChart data={msg.chartData} />
                        </div>
                    )}

                    {msg.role === 'model' && msg.content.includes("```python") && (
                        <div className="mt-3 flex items-center gap-2 text-xs bg-slate-100 text-slate-600 p-2 rounded border border-slate-200 w-fit">
                            <Terminal className="w-3 h-3" />
                            <span>Contains Automation Code</span>
                        </div>
                    )}
                    
                    {/* Render Search Grounding Sources */}
                    {msg.groundingMetadata?.groundingChunks && Array.isArray(msg.groundingMetadata.groundingChunks) && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <h5 className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2">
                                <Search className="w-3 h-3" /> Sources
                            </h5>
                            <div className="flex flex-col gap-1">
                                {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => 
                                    chunk.web?.uri ? (
                                        <a 
                                            key={i} 
                                            href={chunk.web.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline truncate max-w-full block"
                                        >
                                            {chunk.web.title || chunk.web.uri}
                                        </a>
                                    ) : null
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
          ))}
          {(isLoading || isProcessingFile) && (
            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-sm text-slate-500">
                        {isProcessingFile ? "Parsing file..." : "DataMind is analyzing..."}
                    </span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
           {currentFileSnippet && (
               <div className="mb-2 flex items-center gap-2 text-xs bg-indigo-50 text-indigo-700 p-2 rounded border border-indigo-100 w-fit">
                   {fileType === 'pdf' ? <File className="w-3 h-3"/> : <FileSpreadsheet className="w-3 h-3" />}
                   {fileType === 'pdf' ? "PDF Document loaded" : "Dataset loaded"}
               </div>
           )}
           <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
              <label className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition" title="Upload CSV, Excel, or PDF">
                  <input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" className="hidden" onChange={handleFileUpload} />
                  <FileText className="w-5 h-5" />
              </label>
              
              <input 
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-sm p-1 text-slate-800 placeholder:text-slate-400"
                placeholder="Ask about data, visualize columns, or check market trends..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              
              <button 
                onClick={handleSend}
                disabled={isLoading || isProcessingFile || (!input.trim() && !currentFileSnippet)}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                  <Send className="w-4 h-4" />
              </button>
           </div>
           <div className="text-center mt-2">
               <p className="text-[10px] text-slate-400">
                   AI can make mistakes. Verify important data. 
                   {!process.env.API_KEY && <span className="text-red-400 font-bold ml-1 flex items-center justify-center gap-1 inline-flex"><AlertCircle className="w-3 h-3"/> Missing API Key</span>}
               </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;