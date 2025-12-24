
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
  FolderOpen,
  Download
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
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  const templateInputRef = useRef<HTMLInputElement>(null);

  // 选择文件夹并读取 PDF
  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      setDirectoryHandle(handle);
      setFiles([]); // 清空现有

      const pdfFiles: PDFFile[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
          const file = await (entry as FileSystemFileHandle).getFile();
          pdfFiles.push({
            handle: entry as FileSystemFileHandle,
            file,
            originalName: entry.name,
            newName: entry.name,
            status: 'pending'
          });
        }
      }
      setFiles(pdfFiles);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert("无法访问文件夹，请确保您授予了读写权限。");
      }
    }
  };

  const clearFiles = () => {
    if (isProcessing) return;
    setFiles([]);
    setDirectoryHandle(null);
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
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'completed') continue;
      
      setFiles(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing', error: undefined };
        return next;
      });

      try {
        // 1. 转换并提取数据
        const imageBase64 = await convertPdfToImage(files[i].file);
        const extracted = await extractInvoiceData(imageBase64, config.provider);

        // 2. 生成新文件名
        let baseNewName = applyTemplate(config.template, extracted);
        if (config.sanitize) baseNewName = sanitizeFilename(baseNewName);
        const finalName = baseNewName.toLowerCase().endsWith('.pdf') ? baseNewName : `${baseNewName}.pdf`;

        // 3. 执行真正的物理重命名 (如果拥有文件夹权限)
        if (directoryHandle && files[i].handle) {
          try {
            // 创建新文件并写入数据
            const newFileHandle = await directoryHandle.getFileHandle(finalName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(files[i].file);
            await writable.close();

            // 如果新旧文件名不同，则删除旧文件
            if (finalName !== files[i].originalName) {
              await directoryHandle.removeEntry(files[i].originalName);
            }
          } catch (renameErr: any) {
            throw new Error(`写入文件失败: ${renameErr.message}`);
          }
        }

        setFiles(prev => {
          const next = [...prev];
          next[i] = { ...next[i], extracted, newName: finalName, status: 'completed' };
          return next;
        });
      } catch (err: any) {
        setFiles(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: err.message };
          return next;
        });
      }
    }
    setIsProcessing(false);
  };

  // 下载单个文件 (针对非文件夹模式的备选)
  const downloadFile = (file: PDFFile) => {
    const url = URL.createObjectURL(file.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.newName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isTagUsed = (tag: string) => config.template.includes(`{${tag}}`);
  const modelOptions: { id: AIProvider; name: string; desc: string; free?: boolean }[] = [
    { id: 'glm', name: 'GLM-4V-Flash', desc: '智谱AI - 极速视觉 (国内推荐)', free: true },
    { id: 'gemini', name: 'Gemini 3 Flash', desc: 'Google - 多模态旗舰' },
    { id: 'qwen', name: 'Qwen-VL-Plus', desc: '通义千问 - 阿里视觉强项' }
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans">
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
                  {opt.free && <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black">免费额度</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{opt.desc}</p>
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
              className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-xs font-mono"
            />
            <button onClick={() => setConfig({...config, template: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"><Eraser size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {['date', 'merchant', 'amount', 'month', 'invoice', 'currency'].map(tag => (
              <button 
                key={tag} 
                onClick={() => insertTag(tag)} 
                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                  isTagUsed(tag)
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-auto pt-4">
          <button 
            onClick={selectFolder}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
          >
            <FolderOpen size={18} />
            选择本地文件夹
          </button>
          <p className="text-[9px] text-slate-400 mt-2 text-center font-medium leading-relaxed">
            * 推荐选择文件夹以实现真正的本地重命名<br/>
            需在弹出框中选择“允许修改”
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col m-4 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl bg-white">
        <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">重命名工作区</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">{files.length} 个文件</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">
                模式: {directoryHandle ? '本地文件夹同步' : '未选择'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {files.length > 0 && (
              <button 
                onClick={clearFiles}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-400 hover:text-rose-500 transition-all disabled:opacity-30"
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
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {isProcessing ? '处理中...' : '开始本地重命名'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-10 pb-10">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <div className="p-10 bg-slate-50 rounded-full mb-6">
                <FileText size={64} className="text-slate-200" />
              </div>
              <p className="text-lg font-black text-slate-400 uppercase tracking-widest">请选择文件夹开始</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-2">状态</th>
                  <th className="px-6 py-2">原始文件名</th>
                  <th className="px-6 py-2">AI 提取结果</th>
                  <th className="px-6 py-2">目标文件名</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={idx} className="group bg-white border border-slate-100 hover:border-indigo-200 shadow-sm rounded-2xl transition-all duration-300">
                    <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-50">
                      {file.status === 'pending' && <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-full uppercase">等待</span>}
                      {file.status === 'processing' && <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full animate-pulse uppercase">解析中</span>}
                      {file.status === 'completed' && <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full flex items-center gap-1 uppercase"><CheckCircle2 size={10} />完成</span>}
                      {file.status === 'error' && <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-full flex items-center gap-1 uppercase" title={file.error}><AlertCircle size={10} />失败</span>}
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      <span className="text-[12px] font-bold text-slate-600 truncate max-w-[180px] block">{file.originalName}</span>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      {file.extracted && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 truncate max-w-[100px]">{file.extracted.merchant}</span>
                          <span className="text-[10px] font-bold bg-indigo-50 px-2 py-0.5 rounded text-indigo-500">{file.extracted.amount}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ChevronRight size={14} className="text-slate-200" />
                          <span className={`text-[12px] font-mono font-bold ${file.status === 'completed' ? 'text-indigo-600' : 'text-slate-300 italic'}`}>
                            {file.newName}
                          </span>
                        </div>
                        {file.status === 'completed' && !directoryHandle && (
                          <button onClick={() => downloadFile(file)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Download size={14} />
                          </button>
                        )}
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
