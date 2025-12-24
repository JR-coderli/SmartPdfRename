
import React, { useState, useRef } from 'react';
import { 
  FolderOpen, 
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
        // 避免重复添加
        if (!files.some(f => f.originalName === file.name)) {
          pdfFiles.push({
            file,
            originalName: file.name,
            newName: file.name,
            status: 'pending'
          });
        }
      }
    });
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const clearFiles = () => {
    if (isProcessing) return;
    setFiles([]);
  };

  const insertTag = (tag: string) => {
    const input = templateInputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = input.value;
    
    // 智能判断是否需要下划线前缀
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
    
    // 创建一个副本以便逐步更新状态
    const currentFiles = [...files];

    for (let i = 0; i < currentFiles.length; i++) {
      if (currentFiles[i].status === 'completed') continue;
      
      try {
        currentFiles[i].status = 'processing';
        setFiles([...currentFiles]);

        const imageBase64 = await convertPdfToImage(currentFiles[i].file);
        const extracted = await extractInvoiceData(imageBase64, config.provider);
        currentFiles[i].extracted = extracted;

        let baseNewName = applyTemplate(config.template, extracted);
        if (config.sanitize) baseNewName = sanitizeFilename(baseNewName);
        const newFileName = baseNewName.toLowerCase().endsWith('.pdf') ? baseNewName : `${baseNewName}.pdf`;
        currentFiles[i].newName = newFileName;

        currentFiles[i].status = 'completed';
      } catch (err: any) {
        currentFiles[i].status = 'error';
        currentFiles[i].error = err.message || "处理失败";
      }
      setFiles([...currentFiles]);
    }
    setIsProcessing(false);
  };

  // 检查占位符是否在模板中被使用
  const isTagUsed = (tag: string) => config.template.includes(`{${tag}}`);

  const modelOptions: { id: AIProvider; name: string; desc: string; free?: boolean }[] = [
    { id: 'glm', name: 'GLM-4V-Flash', desc: '智谱AI - 高速视觉识别', free: true },
    { id: 'gemini', name: 'Gemini 3 Flash', desc: 'Google - 顶级多模态' },
    { id: 'qwen', name: 'Qwen-VL-Plus', desc: '通义千问 - 视觉精调' }
  ];

  const tags = ['date', 'merchant', 'amount', 'month', 'invoice', 'currency'];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900">
      {/* 隐藏的文件选择器 */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={(e) => e.target.files && handleFiles(e.target.files)} 
        className="hidden" 
        accept=".pdf" 
      />

      <aside className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col gap-6 shadow-sm overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <Zap className="text-white w-5 h-5" fill="white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800 uppercase">AI Smart Rename</h1>
        </div>

        {/* 模型选择 */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Cpu size={12} /> AI 模型选择
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {modelOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setConfig({ ...config, provider: opt.id })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.provider === opt.id 
                  ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' 
                  : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className={`text-[12px] font-bold ${config.provider === opt.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {opt.name}
                  </span>
                  {opt.free && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black">免费</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* 命名模板 */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <SettingsIcon size={12} /> 命名模板
          </h2>
          <div className="relative">
            <input 
              ref={templateInputRef}
              type="text"
              value={config.template}
              onChange={(e) => setConfig({ ...config, template: e.target.value })}
              placeholder="请输入命名模板..."
              className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-xs font-mono transition-all"
            />
            <button 
              onClick={() => setConfig({...config, template: ''})} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
            >
              <Eraser size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {tags.map(tag => (
              <button 
                key={tag} 
                onClick={() => insertTag(tag)} 
                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                  isTagUsed(tag)
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* 操作按钮 */}
        <div className="mt-auto space-y-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            <Files size={18} />
            选择 PDF 文件
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col m-4 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl bg-white">
        <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">重命名工作区</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{files.length} 个文件</span>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest">
                使用模型: {modelOptions.find(o => o.id === config.provider)?.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {files.length > 0 && (
              <button 
                onClick={clearFiles}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-30"
              >
                <Trash2 size={18} />
                清空列表
              </button>
            )}
            <button 
              disabled={files.length === 0 || isProcessing}
              onClick={processFiles}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${
                files.length === 0 || isProcessing 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {isProcessing ? '处理中...' : '一键批量命名'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-10 pb-10">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 transition-opacity duration-500">
              <div className="p-8 bg-slate-50 rounded-full mb-6">
                <FileText size={64} className="text-slate-200" />
              </div>
              <p className="text-lg font-black text-slate-400 uppercase tracking-widest">暂无文件</p>
              <p className="text-sm font-medium text-slate-400 mt-2">请从左侧点击选择需要重命名的发票</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-2">状态</th>
                  <th className="px-6 py-2">原始文件名</th>
                  <th className="px-6 py-2">提取信息</th>
                  <th className="px-6 py-2">重命名预览</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={idx} className="group bg-white border border-slate-100 hover:border-indigo-100 shadow-sm rounded-2xl transition-all duration-300">
                    <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-50">
                      {file.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 uppercase">等待中</span>
                      )}
                      {file.status === 'processing' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 uppercase animate-pulse">
                          <Loader2 size={10} className="animate-spin mr-1.5" /> 处理中
                        </span>
                      )}
                      {file.status === 'completed' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 uppercase">
                          <CheckCircle2 size={10} className="mr-1.5" /> 已完成
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 uppercase" title={file.error}>
                          <AlertCircle size={10} className="mr-1.5" /> 失败
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-slate-700 truncate max-w-[200px]">{file.originalName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">PDF Document</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      {file.extracted ? (
                        <div className="flex flex-wrap gap-1.5">
                          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase">商户</span>
                            <span className="text-[11px] font-bold text-slate-700">{file.extracted.merchant}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                            <span className="text-[9px] font-black text-indigo-300 uppercase">金额</span>
                            <span className="text-[11px] font-black text-indigo-600">{file.extracted.currency} {file.extracted.amount}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-300 italic">待识别...</span>
                      )}
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-50">
                      <div className="flex items-center gap-3">
                        <ChevronRight size={14} className="text-slate-200 group-hover:text-indigo-300 transition-colors" />
                        <span className={`text-[12px] font-mono font-bold transition-colors ${file.status === 'completed' ? 'text-indigo-600' : 'text-slate-300'}`}>
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
