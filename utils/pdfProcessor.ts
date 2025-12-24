
import { ExtractedInfo } from "../types";

declare const pdfjsLib: any;

export const convertPdfToImage = async (file: File): Promise<string> => {
  // Initialize PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  
  // Return base64 string without data prefix
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
};

export const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
};

// Added missing ExtractedInfo type import at the top of the file
export const applyTemplate = (template: string, info: ExtractedInfo): string => {
  let result = template;
  result = result.replace(/{date}/g, info.date);
  result = result.replace(/{merchant}/g, info.merchant);
  result = result.replace(/{invoice}/g, info.invoice);
  result = result.replace(/{month}/g, info.month);
  result = result.replace(/{amount}/g, info.amount.toString());
  result = result.replace(/{currency}/g, info.currency);
  return result;
};
