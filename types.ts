
export type AIProvider = 'glm' | 'gemini' | 'qwen';

export interface ExtractedInfo {
  date: string;
  merchant: string;
  invoice: string;
  month: string;
  amount: number;
  currency: string;
}

export interface PDFFile {
  handle?: FileSystemFileHandle;
  file: File;
  originalName: string;
  newName: string;
  extracted?: ExtractedInfo;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface RenameConfig {
  template: string;
  sanitize: boolean;
  provider: AIProvider;
}
