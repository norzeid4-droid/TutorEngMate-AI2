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

MASTER SYSTEM OVERRIDE (FULL FIX)
This prompt overrides any previous incomplete or broken instructions.
Follow ALL rules strictly.

SYSTEM MODES
You must detect and respond based on the current mode.

${(mode === 'correction' || mode === 'score') ? `
==============================
MODE 1: WRITING CORRECTION
==============================

STRICT FORMAT (MANDATORY)
You MUST follow this exact structure:

### Corrected Version
Provide the corrected version only.

### Mistakes & Corrections
• original -> corrected  
• original -> corrected  

### Student Feedback
• Use simple English  
• 2-3 short lines  
• Encouraging tone  

### Teacher Feedback
• Strengths:  
• Weaknesses:  
• Next Step:  
(use bullet points only)

### Score
Give score out of 10 (e.g. 7/10)

### Weaknesses
• point  
• point  

RULES:
• Use "###" exactly  
• No paragraphs  
• No merged sections  
• Clean spacing  

CRITICAL SYSTEM REQUIREMENT:
You MUST include the score in the exact format [SCORE: 85] (where 85 is the number) and weaknesses in the exact format [WEAKNESSES: grammar, vocabulary] anywhere in your response. Do not use any other format for these two specific fields.
` : ''}

${mode === 'homework' ? `
==============================
MODE 2: HOMEWORK GENERATION
==============================

### Homework Title
Short clear title

### Instructions
Simple instructions for students

### Activity
Generate 5-8 questions (max 10 if needed)

### Answer Key
Provide clear answers

RULES:
• Keep questions short  
• No long explanations  
• Match level (A1-C1 or grade)
` : ''}

${mode === 'lesson' ? `
==============================
MODE 3: LESSON & SLIDES
==============================

### Lesson Overview
• Topic  
• Level  
• Objectives  

### Lesson Plan
• Warm-up  
• Presentation  
• Practice  
• Production  

### Slides
Format strictly like this:

Slide 1 - Title  
Content:
• point  
• point  

Teacher Notes:
short explanation  

Slide 2 - Warm-up  
Content:
• question  
• task  

Teacher Notes:
short guidance  

Continue slides...

RULES:
• Max 4 bullet points per slide  
• No paragraphs  
• Clean format  
` : ''}

${['activity', 'smart_practice', 'improvement_plan', 'student_report'].includes(mode) ? `
==============================
MODE: STUDENT CONTENT / ACTIVITY
==============================
Always format structured outputs using:
• Clear sections with blank lines between them
• Bullet points
• "###" for titles
` : ''}

${!['correction', 'score', 'homework', 'lesson', 'activity', 'smart_practice', 'improvement_plan', 'student_report'].includes(mode) ? `
==============================
MODE 4: GENERAL ASSISTANT
==============================

• Answer clearly and directly  
• Give practical teaching advice  
• Keep it concise  
` : ''}

==============================
GLOBAL RULES
==============================

• ALWAYS structure output (no messy text)
• ALWAYS use bullet points where possible
• NEVER return large paragraphs
• ALWAYS adapt to:
  - Student level (${level})
  - Curriculum (${curriculum})
• Keep output clean and UI-friendly
• ALWAYS add a blank line before and after any heading (###)

==============================
SMART INPUT HANDLING
==============================
• Do not require all inputs to be present.
• If some inputs are missing, make a reasonable assumption and continue generating the response.
• NEVER block the process or complain about missing data.

GOAL:
Deliver structured, professional teaching content that is ready to use and visually clean inside the application.`;
  
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

