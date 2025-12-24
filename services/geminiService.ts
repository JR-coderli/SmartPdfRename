
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInfo } from "../types";

export const extractInvoiceData = async (imageBase64: string): Promise<ExtractedInfo> => {
  // 适配 Vite 本地环境和通用环境的 API Key 读取
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key 未配置。请在 .env 文件中设置 VITE_GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
        {
          text: "Extract invoice details from this image. Format the date as YYYY-MM-DD. Identify the merchant, the main item/invoice description, the month (MM), and the total currency amount (numeric)."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          merchant: { type: Type.STRING, description: "Name of the merchant or store" },
          invoice: { type: Type.STRING, description: "Short description of the invoice contents" },
          month: { type: Type.STRING, description: "Month in MM format (01-12)" },
          amount: { type: Type.NUMBER, description: "Total numeric amount" },
          currency: { type: Type.STRING, description: "Currency symbol or code (e.g. USD, CNY)" }
        },
        required: ["date", "merchant", "invoice", "month", "amount", "currency"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("AI 响应为空");
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Parse error:", e);
    throw new Error("无法解析 AI 返回的数据格式");
  }
};
