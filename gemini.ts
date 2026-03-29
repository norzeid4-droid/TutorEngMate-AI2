import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY2 });

    const { message } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: message,
    });

    res.status(200).json({
      text: response.text,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: error.message || "Something went wrong",
    });
  }
}
