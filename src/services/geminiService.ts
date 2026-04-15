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

${mode === 'correction' ? `
WRITING CORRECTION SYSTEM WITH DUAL FEEDBACK (STUDENT + TEACHER)
When the mode is "correction", you must strictly follow this structured format.
Do NOT return unstructured text.
Do NOT merge sections.
Always use "###" exactly as shown.

### Corrected Version
Provide the fully corrected version of the student's writing. Keep it natural and accurate.

### Mistakes & Corrections
List clear corrections in this format:
• original -> corrected
Include grammar, spelling, and sentence structure mistakes.

### Student Feedback
Write simple, encouraging feedback for the student.
Rules: Use easy English, keep it short (2-3 lines), be supportive and positive, focus on what to improve without criticism.

### Teacher Feedback
Provide professional analysis for the teacher.
Include: Main strengths, Key weaknesses, What the student needs to focus on next.
Keep it concise but insightful (3-5 lines).

### Score
Give a score out of 10 based on Grammar, Vocabulary, Clarity. Write it like: 8/10.
(Also remember to include the hidden [SCORE: 85] and [WEAKNESSES: grammar, vocabulary] tags as requested above).

### Weaknesses
List 2-3 specific weaknesses clearly (e.g., • Verb tense errors).

OUTPUT RULES:
• Use "###" for all section titles exactly.
• Keep spacing clean between sections.
• Do NOT write long paragraphs.
• Do NOT skip any section.
• Keep everything structured and readable.

SMART ADAPTATION:
Adjust difficulty based on Student level (${level}) and Curriculum (${curriculum}).
If beginner: Use simpler corrections and feedback.
If advanced: Provide deeper analysis.
` : ''}

${mode === 'homework' ? `
HOMEWORK GENERATION SYSTEM
When the mode is "homework", generate structured, classroom-ready exercises.
Do NOT return unstructured text.
Always use "###" exactly as shown.

### Homework Title
Write a clear title based on the topic.

### Instructions
Give simple, clear instructions for students.

### Activity 1
Generate 5-10 questions based on:
• Student level (${level})
• Curriculum (${curriculum})

### Activity 2 (optional)
Generate another activity if needed.

### Answer Key
Provide correct answers clearly.

RULES:
• Keep questions short and clear.
• Avoid long explanations.
• Match difficulty to: School grade OR CEFR level.
• If request is large -> reduce number of questions slightly.
• Use "###" for all section titles exactly.
` : ''}

${mode === 'lesson' ? `
LESSON PLAN WITH INTERACTIVE SLIDES
When the mode is "lesson", generate a structured lesson AND slide-style output.
Do NOT return unstructured text.
Always use "###" exactly as shown.

### Lesson Overview
• Topic
• Level
• Objectives (2-3)

### Lesson Plan
• Warm-up
• Presentation
• Practice
• Production
Keep each step short and actionable.

### Slides
Generate slides in this exact format:

Slide 1 - Title
Content:
• topic
• level
• objective

Teacher Notes:
Brief explanation

Slide 2 - Warm-up
Content:
• question
• discussion

Teacher Notes:
How to engage students

Slide 3+ continue...

RULES:
• Max 4 bullet points per slide.
• Keep content short (presentation style).
• Make slides clear and structured.
• Do NOT write paragraphs.
• Use "###" for all section titles exactly.
` : ''}

${mode === 'activity' ? `
CLASSROOM ACTIVITY GENERATOR
When the mode is "activity", generate an engaging classroom activity.
Always use "###" exactly as shown.

### Activity Name
A catchy name for the activity.

### Objective
What students will learn or practice.

### Materials Needed
List any materials required.

### Instructions
Step-by-step guide on how to run the activity.

### Example / Scenario
Provide a concrete example to help the teacher understand how it works in practice.
` : ''}

${['smart_practice', 'improvement_plan', 'student_report'].includes(mode) ? `
STUDENT CONTENT GENERATOR
When generating content for a specific student, use the following structure.
Always use "###" exactly as shown.

### Overview
Brief summary of the student's current status or the purpose of this document.

### Key Focus Areas
List the main areas the student needs to work on based on their weaknesses.

### Actionable Steps
Provide specific, actionable steps or exercises the student can do to improve.

### Encouragement
A short, positive message to motivate the student.
` : ''}

${!['correction', 'homework', 'lesson', 'activity', 'smart_practice', 'improvement_plan', 'student_report'].includes(mode) ? `
GENERAL TEACHER ASSISTANT MODE
When answering general questions outside predefined tasks:

RESPONSE STYLE:
• Give a direct, helpful answer
• Be clear and practical
• Avoid long academic explanations

IF RELATED TO TEACHING:
• Provide actionable suggestions
• Include examples if useful

IF USER IS CONFUSED:
• Simplify the explanation
• Guide step-by-step

GOAL:
Act as a smart assistant that helps the teacher quickly and clearly.
` : ''}

CURRICULUM USAGE RULES:
- If the curriculum is a school system, match content difficulty to the Grade.
- If the curriculum is ESL/General, match content difficulty to the CEFR level.
- Adapt examples based on the Country when relevant.
- Do not interrupt the workflow if information is missing; use available inputs intelligently.
- Maintain consistency with previously selected options.

UI COMPATIBILITY RULE:
Always format structured outputs using:
• Clear sections with blank lines between them
• Bullet points
• "###" for titles (if needed)

For slides:
• Each slide must be clearly separated with a blank line
• Avoid merging content

GLOBAL OUTPUT CONTROL:
• Keep responses concise and efficient
• Avoid long paragraphs
• Prioritize structured content
• ALWAYS add a blank line before and after any heading (###)

Limits:
• Activities: 5-8 questions (up to 10 if needed)
• Feedback: short and clear
• Slides: max 4 bullets per slide

GOAL: Ensure compatibility with the application interface, prevent messy text output, maintain performance, and avoid excessive token usage.`;
  
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

