import { GoogleGenAI } from "@google/genai";

export const getApiKey = () => {
  try {
    // @ts-ignore
    if (import.meta.env.VITE_GEMINI_API_KEY2) return import.meta.env.VITE_GEMINI_API_KEY2;
    // @ts-ignore
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY2) return process.env.GEMINI_API_KEY2;
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  } catch (e) {}
  return "";
};

export async function generateTeacherResponse(
  mode: string,
  input: string,
  level: string,
  curriculum: string,
  language: string,
  teacherProfile: any,
  studentContext: any,
  teacherRequest?: string,
  options?: any
) {
  const prompt = `Mode: ${mode}\nInput: ${input}\nLevel: ${level}\nCurriculum: ${curriculum}\nLanguage: ${language}\nTeacher: ${JSON.stringify(teacherProfile)}\nStudent: ${JSON.stringify(studentContext)}\nRequest: ${teacherRequest}\nOptions: ${JSON.stringify(options)}

IMPORTANT INSTRUCTIONS:
If the mode is 'score' or 'correction', you MUST include the score in the exact format [SCORE: 85] (where 85 is the number) and weaknesses in the exact format [WEAKNESSES: grammar, vocabulary] anywhere in your response. Do not use any other format for these two specific fields.`;
  
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set VITE_GEMINI_API_KEY2 in Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  
  return response.text || "";
}

