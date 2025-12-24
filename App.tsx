
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
  Info,
  Tag,
  Eraser
} from 'lucide-react';
import { PDFFile, RenameConfig } from './types';
import { extractInvoiceData } from './services/geminiService';
import { convertPdfToImage, applyTemplate, sanitizeFilename } from './utils/pdfProcessor';

const App: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [config, setConfig] = useState<RenameConfig>({
    template: '{date}_{merchant}_{amount}',
    sanitize: true
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  
  const templateInputRef = useRef<HTMLInputElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    const pdfFiles: PDFFile[] = [];
    Array.from(fileList).forEach(file => {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push({
          file,
          originalName: file.name,
          newName: file.name,
          status: 'pending'
        });
      }
    });
    setFiles(pdfFiles);
  };

  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      setDirectoryHandle(handle);
      setUsingFallback(false);
      
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
      if (err.name === 'SecurityError' || err.message.includes('Cross origin')) {
        console.warn('FileSystem API blocked by iframe constraints. Using fallback input.');
        setUsingFallback(true);
        fallbackInputRef.current?.click();
      } else if (err.name !== 'AbortError') {
        console.error('Selection failed:', err);
      }
    }
  };

  const insertTag = (tag: string) => {
    const input = templateInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = input.value;
    
    // 自动下划线逻辑：如果插入点前有内容且不是下划线，则补一个下划线
    const prefix = (start > 0 && text[start - 1] !== '_' && text[start - 1] !== '{') ? '_' : '';
    const tagContent = `${prefix}{${tag}}`;
    
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

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === 'completed') continue;

      try {
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);

        const imageBase64 = await convertPdfToImage(updatedFiles[i].file);
        const extracted = await extractInvoiceData(imageBase64);
        updatedFiles[i].extracted = extracted;

        let baseNewName = applyTemplate(config.template, extracted);
        if (config.sanitize) {
          baseNewName = sanitizeFilename(baseNewName);
        }
        const newFileName = baseNewName.toLowerCase().endsWith('.pdf') ? baseNewName : `${baseNewName}.pdf`;
        updatedFiles[i].newName = newFileName;

        if (updatedFiles[i].handle) {
          try {
            if ((updatedFiles[i].handle as any).move) {
              await (updatedFiles[i].handle as any).move(newFileName);
            } else if (directoryHandle) {
              const newFileHandle = await directoryHandle.getFileHandle(newFileName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(updatedFiles[i].file);
              await writable.close();
              await directoryHandle.removeEntry(updatedFiles[i].originalName);
            }
            updatedFiles[i].status = 'completed';
          } catch (renameErr: any) {
            updatedFiles[i].status = 'error';
            updatedFiles[i].error = "系统权限错误或文件被占用: " + renameErr.message;
          }
        } else {
          updatedFiles[i].status = 'completed';
        }
      } catch (err: any) {
        updatedFiles[i].status = 'error';
        updatedFiles[i].error = "解析出错: " + err.message;
      }
      setFiles([...updatedFiles]);
    }
    setIsProcessing(false);
  };

  const tags = [
    { id: 'date', label: '日期' },
    { id: 'merchant', label: '商家名称' },
    { id: 'invoice', label: '发票内容' },
    { id: 'month', label: '月份' },
    { id: 'amount', label: '金额' },
    { id: 'currency', label: '货币' }
  ];

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      <input 
        type="file" 
        multiple
        ref={fallbackInputRef}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
        accept=".pdf"
      />

      <aside className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col gap-8 shadow-sm overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <FileText className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-black tracking-tighter text-slate-800 uppercase">Smart PDF Rename</h1>
        </div>

        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <SettingsIcon size={12} /> 命名规则设置
            </h2>
            
            <div className="space-y-4">
              <div className="relative group">
                <input 
                  ref={templateInputRef}
                  type="text"
                  value={config.template}
                  onChange={(e) => setConfig({ ...config, template: e.target.value })}
                  className="w-full pl-3 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-mono transition-all"
                  placeholder="例如: {date}_{merchant}"
                />
                <button 
                  onClick={() => setConfig({...config, template: ''})}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Eraser size={16} />
                </button>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 px-1">
                  <Tag size={12} /> 点击占位符 (自动补下划线):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => insertTag(tag.id)}
                      className="px-3 py-2 bg-white text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all active:scale-95 shadow-sm"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="sanitize"
                checked={config.sanitize}
                onChange={(e) => setConfig({ ...config, sanitize: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="sanitize" className="text-[11px] text-slate-500 cursor-pointer font-bold uppercase tracking-tight">清理非法字符 (Windows)</label>
            </div>
          </section>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px] uppercase">
              <Info size={14} />
              <span>部署建议</span>
            </div>
            <p className="text-[10px] text-indigo-600 leading-relaxed font-medium">
              在本地 localhost 环境下运行可获得真实的文件重命名权限。
            </p>
          </div>
        </div>

        <div className="mt-auto pt-6">
           <button 
            onClick={selectFolder}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
          >
            <FolderOpen size={18} />
            {files.length > 0 ? '重新选择' : '选择 PDF 文件夹'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white m-4 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl">
        <header className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800">发票处理中心</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {files.length} 个项目
              </span>
              {usingFallback && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Web 兼容模式</span>
              )}
            </div>
          </div>
          <button 
            disabled={files.length === 0 || isProcessing}
            onClick={processFiles}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-lg ${
              files.length === 0 || isProcessing
              ? 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100'
            }`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
            {isProcessing ? '正在处理...' : '执行批量重命名'}
          </button>
        </header>

        <div className="flex-1 overflow-auto px-6">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 p-20">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100">
                <FolderOpen size={32} className="text-slate-200" />
              </div>
              <p className="text-lg font-black text-slate-400">尚未加载 PDF</p>
              <p className="text-sm mt-1 text-slate-300 font-medium">点击左侧按钮导入文件夹或文件</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-2">状态</th>
                  <th className="px-6 py-2">原始名称</th>
                  <th className="px-6 py-2">识别信息</th>
                  <th className="px-6 py-2">目标名称</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={idx} className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden group">
                    <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-50">
                      {file.status === 'pending' && <span className="text-[10px] font-black text-slate-400 flex items-center gap-2">准备就绪</span>}
                      {file.status === 'processing' && <span className="text-[10px] font-black text-indigo-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> 处理中</span>}
                      {file.status === 'completed' && <span className="text-[10px] font-black text-emerald-500 flex items-center gap-2"><CheckCircle2 size={12} /> 已完成</span>}
                      {file.status === 'error' && (
                        <div className="group/err relative inline-block">
                          <span className="text-[10px] font-black text-rose-500 flex items-center gap-2 cursor-help"><AlertCircle size={12} /> 失败</span>
                          <div className="absolute left-0 bottom-full mb-3 w-56 bg-slate-900 text-white text-[10px] p-3 rounded-xl hidden group-hover/err:block z-50 shadow-2xl">
                            {file.error}
                            <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      <div className="text-xs font-bold text-slate-600 truncate max-w-[180px]" title={file.originalName}>
                        {file.originalName}
                      </div>
                    </td>
                    <td className="px-6 py-5 border-y border-slate-50">
                      {file.extracted ? (
                        <div className="flex gap-2">
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold truncate max-w-[100px]">{file.extracted.merchant}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold">{file.extracted.currency}{file.extracted.amount}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-200 font-bold italic">等待中</span>
                      )}
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-50">
                      <div className="flex items-center gap-3">
                        <ChevronRight size={14} className="text-slate-200" />
                        <span className={`text-xs font-mono font-bold truncate max-w-[200px] ${file.status === 'completed' ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {file.status === 'pending' ? '...' : file.newName}
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
