import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: any, res: any) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const { message } = req.body;

    const result = await model.generateContent(message);
    const response = await result.response;

    res.status(200).json({
      text: response.text(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Something went wrong",
    });
  }
}