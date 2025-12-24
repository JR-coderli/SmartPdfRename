
import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Play, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Eraser,
  Cpu,
  Zap,
  Trash2,
  Files
} from 'lucide-react';
import { PDFFile, RenameConfig, AIProvider } from './types';
import { extractInvoiceData } from './services/aiService';
import { convertPdfToImage, applyTemplate, sanitizeFilename } from './utils/pdfProcessor';

const App: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [config, setConfig] = useState<RenameConfig>({
    template: '{date}_{merchant}_{amount}',
    sanitize: true,
    provider: 'glm'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const templateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    const pdfFiles: PDFFile[] = [];
    Array.from(fileList).forEach(file => {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // 允许重复添加，或者你可以根据文件名去重
        pdfFiles.push({
          file,
          originalName: file.name,
          newName: file.name,
          status: 'pending'
        });
      }
    });
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const clearFiles = () => {
    if (isProcessing) return;
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertTag = (tag: string) => {
    const input = templateInputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = input.value;
    
    const needsPrefix = (start > 0 && text[start - 1] !== '_' && text[start - 1] !== '{');
    const tagContent = `${needsPrefix ? '_' : ''}{${tag}}`;
    
    const newText = text.substring(0, start) + tagContent + text.substring(end);
    setConfig({ ...config, template: newText });
    
    setTimeout(() => {
      input.focus();
      const newPos = start + tagContent.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const processFiles = async () => {
    if (isProcessing || files.length === 0) return;
    setIsProcessing(true);
    
    // 这种方式确保我们操作的是最新的状态
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'completed') continue;
      
      setFiles(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing', error: undefined };
        return next;
      });

      try {
        const imageBase64 = await convertPdfToImage(files[i].file);
        const extracted = await extractInvoiceData(imageBase64, config.provider);

        setFiles(prev => {
          const next = [...prev];
          let baseNewName = applyTemplate(config.template, extracted);
          if (config.sanitize) baseNewName = sanitizeFilename(baseNewName);
          const finalName = baseNewName.toLowerCase().endsWith('.pdf') ? baseNewName : `${baseNewName}.pdf`;
          
          next[i] = { 
            ...next[i], 
            extracted, 
            newName: finalName, 
            status: 'completed' 
          };
          return next;
        });
      } catch (err: any) {
        console.error("Processing error:", err);
        setFiles(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: err.message || "接口调用异常" };
          return next;
        });
      }
    }
    setIsProcessing(false);
  };

  const isTagUsed = (tag: string) => config.template.includes(`{${tag}}`);

  const modelOptions: { id: AIProvider; name: string; desc: string; free?: boolean }[] = [
    { id: 'glm', name: 'GLM-4V-Flash', desc: '智谱AI - 极速视觉 (国内推荐)', free: true },
    { id: 'gemini', name: 'Gemini 3 Flash', desc: 'Google - 多模态旗舰' },
    { id: 'qwen', name: 'Qwen-VL-Plus', desc: '通义千问 - 阿里视觉强项' }
  ];

  const tags = ['date', 'merchant', 'amount', 'month', 'invoice', 'currency'];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans">
      <input type="file" multiple ref={fileInputRef} onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" accept=".pdf" />

      <aside className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col gap-6 shadow-sm overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <Zap className="text-white w-5 h-5" fill="white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800 uppercase">AI Smart Rename</h1>
        </div>

        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Cpu size={12} /> 选择 AI 模型
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {modelOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setConfig({ ...config, provider: opt.id })}
                className={`p-3 rounded-xl border text-left transition-all group ${
                  config.provider === opt.id 
                  ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' 
                  : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className={`text-[12px] font-bold ${config.provider === opt.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {opt.name}
                  </span>
                  {opt.free && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black">免费额度</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-medium group-hover:text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <SettingsIcon size={12} /> 命名模板配置
          </h2>
          <div className="relative group">
            <input 
              ref={templateInputRef}
              type="text"
              value={config.template}
              onChange={(e) => setConfig({ ...config, template: e.target.value })}
              placeholder="例如: {date}_{merchant}"
              className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-xs font-mono transition-all"
            />
            <button onClick={() => setConfig({...config, template: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"><Eraser size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {tags.map(tag => (
              <button 
                key={tag} 
                onClick={() => insertTag(tag)} 
                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                  isTagUsed(tag)
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/30'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-auto pt-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
          >
            <Files size={18} />
            导入 PDF 文件
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col m-4 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl bg-white">
        <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">重命名工作区</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">{files.length} 个项目</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
                活跃模型: {modelOptions.find(o => o.id === config.provider)?.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {files.length > 0 && (
              <button 
                onClick={clearFiles}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-30"
              >
                <Trash2 size={16} />
                清空列表
              </button>
            )}
            <button 
              disabled={files.length === 0 || isProcessing}
              onClick={processFiles}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${
                files.length === 0 || isProcessing 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5'
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {isProcessing ? '处理中...' : '开始批量执行'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-10 pb-10 custom-scrollbar">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 animate-in fade-in duration-700">
              <div className="p-10 bg-slate-50 rounded-full mb-6 ring-8 ring-slate-50/50">
                <FileText size={64} className="text-slate-200" />
              </div>
              <p className="text-lg font-black text-slate-400 uppercase tracking-widest">还没有添加任何文件</p>
              <p className="text-sm font-medium text-slate-400 mt-2">点击左侧“导入文件”开始工作</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-2">进度</th>
                  <th className="px-6 py-2">原始文件名</th>
                  <th className="px-6 py-2">AI 提取预览</th>
                  <th className="px-6 py-2">新文件名</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={idx} className="group bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md shadow-sm rounded-2xl transition-all duration-300">
                    <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-50">
                      {file.status === 'pending' && <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-full">等待</span>}
                      {file.status === 'processing' && <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full animate-pulse">解析中</span>}
                      {file.status === 'completed' && <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full flex items-center w-fit gap-1"><CheckCircle2 size={10} />完成</span>}
                      {file.status === 'error' && <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-full flex items-center w-fit gap-1" title={file.error}><AlertCircle size={10} />错误</span>}
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-slate-600 truncate max-w-[200px]">{file.originalName}</span>
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">PDF File</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      {file.error ? (
                        <span className="text-[10px] text-rose-400 font-medium italic truncate max-w-[150px]">{file.error}</span>
                      ) : file.extracted ? (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{file.extracted.merchant}</span>
                          <span className="text-[10px] font-bold bg-indigo-50 px-2 py-0.5 rounded text-indigo-500">{file.extracted.currency} {file.extracted.amount}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-200 italic">待分析...</span>
                      )}
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-50">
                      <div className="flex items-center gap-3">
                        <ChevronRight size={14} className="text-slate-200 group-hover:text-indigo-400 transition-colors" />
                        <span className={`text-[12px] font-mono font-bold transition-colors ${file.status === 'completed' ? 'text-indigo-600' : 'text-slate-300 italic'}`}>
                          {file.newName}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
