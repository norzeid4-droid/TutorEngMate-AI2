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
  options?: any,
  imageBase64?: string
) {
  const prompt = `Mode: ${mode}\nInput: ${input}\nLevel: ${level}\nCurriculum: ${curriculum}\nLanguage: ${language}\nTeacher: ${JSON.stringify(teacherProfile)}\nStudent: ${JSON.stringify(studentContext)}\nRequest: ${teacherRequest}\nOptions: ${JSON.stringify(options)}

IMPORTANT INSTRUCTIONS:
If the mode is 'score' or 'correction', you MUST include the score in the exact format [SCORE: 85] (where 85 is the number) and weaknesses in the exact format [WEAKNESSES: grammar, vocabulary] anywhere in your response. Do not use any other format for these two specific fields.

CURRICULUM USAGE RULES:
- If the curriculum is a school system, match content difficulty to the Grade.
- If the curriculum is ESL/General, match content difficulty to the CEFR level.
- Adapt examples based on the Country when relevant.
- Do not interrupt the workflow if information is missing; use available inputs intelligently.
- Maintain consistency with previously selected options.`;
  
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set VITE_GEMINI_API_KEY2 in Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let contents: any = prompt;
  
  if (imageBase64) {
    const mimeType = imageBase64.match(/data:(.*?);base64,/)?.[1] || "image/jpeg";
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    contents = {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: prompt }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
  });
  
  return response.text || "";
}

