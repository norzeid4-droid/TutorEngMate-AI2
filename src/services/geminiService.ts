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
  
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: prompt }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to generate response");
  }
  return data.text || "";
}
