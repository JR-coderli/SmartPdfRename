
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInfo, AIProvider } from "../types";

const SYSTEM_PROMPT = `你是一个专业的发票 OCR 助手。
请从图片中提取：日期(date)、商户名(merchant)、发票内容简述(invoice)、月份(month,两位数字)、金额(amount,数字)、货币符号(currency)。
如果某些信息模糊，请根据上下文推断最可能的名称。
不要返回 "Not Specified"，如果找不到，请写 "未知"。
日期必须符合 YYYY-MM-DD 格式。`;

const RESPONSE_FORMAT_INSTRUCTION = "必须直接返回 JSON 格式，不要包含任何解释性文字。";

// 通用的 JSON 提取器，处理 AI 可能返回的 Markdown 代码块
const parseSafeJSON = (text: string): ExtractedInfo => {
  try {
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON 解析失败:", text);
    throw new Error("AI 返回的数据格式不正确，无法解析。");
  }
};

const callGLM = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("请在 .env 中配置 VITE_GLM_API_KEY");
  
  try {
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
    
    if (!response.ok) {
      if (response.status === 405 || response.status === 0) throw new Error("请求被拦截 (CORS)，请检查网络或使用代理。");
      const errData = await response.json();
      throw new Error(errData.error?.message || "GLM 接口请求失败");
    }

    const data = await response.json();
    return parseSafeJSON(data.choices[0].message.content);
  } catch (err: any) {
    throw new Error(`GLM 错误: ${err.message}`);
  }
};

const callQwen = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("请在 .env 中配置 VITE_QWEN_API_KEY");
  
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
  
  if (!response.ok) throw new Error("Qwen 接口请求失败");
  const data = await response.json();
  return parseSafeJSON(data.choices[0].message.content);
};

const callGemini = async (imageBase64: string, apiKey: string): Promise<ExtractedInfo> => {
  if (!apiKey) throw new Error("请在 .env 中配置 VITE_GEMINI_API_KEY");
  
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
  
  return parseSafeJSON(response.text || "{}");
};

export const extractInvoiceData = async (imageBase64: string, provider: AIProvider): Promise<ExtractedInfo> => {
  const env = (import.meta as any).env;
  
  switch (provider) {
    case 'glm':
      return await callGLM(imageBase64, env.VITE_GLM_API_KEY);
    case 'qwen':
      return await callQwen(imageBase64, env.VITE_QWEN_API_KEY);
    case 'gemini':
      return await callGemini(imageBase64, env.VITE_GEMINI_API_KEY);
    default:
      throw new Error("未知的 AI 提供商");
  }
};
