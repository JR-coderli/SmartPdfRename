
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInfo, AIProvider } from "../types";

// 提示词模板
const SYSTEM_PROMPT = "你是一个专业的发票识别助手。请从图片中提取发票信息。日期格式必须为 YYYY-MM-DD，月份格式为 MM（如 01），金额为纯数字。";
const RESPONSE_FORMAT_INSTRUCTION = "请直接返回 JSON 格式数据，包含字段: date, merchant, invoice, month, amount, currency。";

// 智谱 GLM-4V-Flash (视觉模型)
const callGLM = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("未配置 VITE_GLM_API_KEY");
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "glm-4v-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${SYSTEM_PROMPT} ${RESPONSE_FORMAT_INSTRUCTION}` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(data.choices[0].message.content);
};

// 通义千问 Qwen-VL-Plus (视觉模型)
const callQwen = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("未配置 VITE_QWEN_API_KEY");
  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "qwen-vl-plus",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${SYSTEM_PROMPT} ${RESPONSE_FORMAT_INSTRUCTION}` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  let content = data.choices[0].message.content;
  content = content.replace(/```json|```/g, "").trim();
  return JSON.parse(content);
};

// Google Gemini 3 Flash
const callGemini = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("未配置 VITE_GEMINI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: `${SYSTEM_PROMPT} ${RESPONSE_FORMAT_INSTRUCTION}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          merchant: { type: Type.STRING },
          invoice: { type: Type.STRING },
          month: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          currency: { type: Type.STRING }
        },
        required: ["date", "merchant", "invoice", "month", "amount", "currency"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const extractInvoiceData = async (imageBase64: string, provider: AIProvider): Promise<ExtractedInfo> => {
  const env = (import.meta as any).env;
  
  switch (provider) {
    case 'glm':
      return await callGLM(imageBase64, env.VITE_GLM_API_KEY || "");
    case 'qwen':
      return await callQwen(imageBase64, env.VITE_QWEN_API_KEY || "");
    case 'gemini':
      return await callGemini(imageBase64, env.VITE_GEMINI_API_KEY || "");
    default:
      throw new Error("不支持的 Provider");
  }
};
