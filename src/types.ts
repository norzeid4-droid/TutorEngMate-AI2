export interface TeacherProfile {
  name: string;
  email: string;
  country: string;
  teachingType: string;
  curriculum: string;
  schoolCountry?: string;
  schoolCurriculumType?: string;
  schoolGrade?: string;
  schoolCEFR?: string;
  levels: string[];
  skills: string[];
}

export interface WritingEntry {
  date: string;
  originalText: string;
  score: number;
  feedback: string;
}

export interface Student {
  id: string;
  name: string;
  level: string;
  curriculum: string;
  schoolCountry?: string;
  schoolCurriculumType?: string;
  schoolGrade?: string;
  schoolCEFR?: string;
  weaknesses: string[];
  notes: string;
  history: WritingEntry[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}
