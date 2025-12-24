
import { ExtractedInfo } from "../types";

declare const pdfjsLib: any;

export const convertPdfToImage = async (file: File): Promise<string> => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  
  // 提高缩放比例到 2.0，增强清晰度
  const viewport = page.getViewport({ scale: 2.0 });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  
  // 使用较高质量
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
};

export const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
};

export const applyTemplate = (template: string, info: ExtractedInfo): string => {
  let result = template;
  result = result.replace(/{date}/g, info.date || '未知日期');
  result = result.replace(/{merchant}/g, info.merchant || '未知商户');
  result = result.replace(/{invoice}/g, info.invoice || '发票');
  result = result.replace(/{month}/g, info.month || '00');
  result = result.replace(/{amount}/g, (info.amount !== undefined ? info.amount : '0').toString());
  result = result.replace(/{currency}/g, info.currency || '');
  return result;
};
