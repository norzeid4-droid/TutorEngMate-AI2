import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTeacherResponse } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { auth, signInWithGoogle, loginWithEmail, signupWithEmail, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getTeacherProfile, saveTeacherProfile, subscribeToStudents, addStudent, addWritingEntry, updateStudentWeaknesses, getChatSessions, saveChatSession, deleteChatSession } from './services/firebaseService';
import { ChatSession, ChatMessage } from './types';
import {
  LayoutDashboard,
  PenTool,
  Award,
  Lightbulb,
  Home,
  BookOpen,
  TrendingUp,
  Settings,
  ChevronRight,
  Sparkles,
  Loader2,
  Copy,
  Check,
  User,
  Mail,
  Users,
  Plus,
  ArrowLeft,
  FileText,
  X,
  Info,
  MessageSquare,
  Send,
  Trash2,
  Menu
} from 'lucide-react';
import { TeacherProfile, Student } from './types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Types & Constants ---

type PageId = 'dashboard' | 'correction' | 'activity' | 'homework' | 'lesson' | 'students' | 'settings' | 'score' | 'assistant';

interface PageDef {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  description: string;
  placeholder?: string;
  mode?: string;
  category: 'Overview' | 'Core Tools' | 'Content Generation' | 'Analytics' | 'System';
}

const PAGES: PageDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Overview and quick actions', category: 'Overview' },
  { id: 'assistant', label: 'AI Assistant', icon: <MessageSquare className="w-4 h-4" />, description: 'Ask any teaching-related question or get advice.', placeholder: 'Ask me anything about teaching, lesson planning, or classroom management...', mode: 'assistant', category: 'Core Tools' },
  { id: 'correction', label: 'Writing Correction', icon: <PenTool className="w-4 h-4" />, description: 'Identify errors and provide structured feedback.', placeholder: 'Paste student writing here for detailed correction...', mode: 'correction', category: 'Core Tools' },
  { id: 'score', label: 'Evaluate Writing', icon: <Award className="w-4 h-4" />, description: 'Assess writing with a standardized band score.', placeholder: 'Paste student writing here for scoring...', mode: 'score', category: 'Core Tools' },
  { id: 'activity', label: 'Activities Generator', icon: <Lightbulb className="w-4 h-4" />, description: 'Create targeted classroom or homework activities.', placeholder: 'What topic or skill would you like activities for?', mode: 'activity', category: 'Content Generation' },
  { id: 'homework', label: 'Homework Builder', icon: <Home className="w-4 h-4" />, description: 'Design comprehensive assignments.', placeholder: 'Describe the homework focus (e.g., Past Simple, Environment vocabulary)...', mode: 'homework', category: 'Content Generation' },
  { id: 'lesson', label: 'Lesson Builder', icon: <BookOpen className="w-4 h-4" />, description: 'Structure a complete lesson plan.', placeholder: 'What is the main objective of your lesson?', mode: 'lesson', category: 'Content Generation' },
  { id: 'students', label: 'Students & Progress', icon: <Users className="w-4 h-4" />, description: 'Manage students and track their progress.', category: 'Analytics' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, description: 'System preferences and account management.', category: 'System' },
];

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Primary', 'Prep', 'Secondary'];
const CURRICULA = [
  'National Curriculum (Egypt/General)',
  'Saudi Curriculum (Ministry of Education)',
  'UAE Curriculum (Ministry of Education)',
  'British Curriculum',
  'American Curriculum / Diploma',
  'IGCSE (Cambridge / Edexcel)',
  'IB Programs',
  'ESL Learners',
  'EFL Learners',
  'Other'
];

// --- Helper: Parse Markdown into Sections ---
const parseMarkdownIntoSections = (markdown: string) => {
  const lines = markdown.split('\n');
  const sections: { title: string; content: string; id: string }[] = [];
  let currentTitle = 'Overview';
  let currentContent: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (currentContent.length > 0 || currentTitle !== 'Overview') {
        sections.push({
          title: currentTitle.replace(/^#+\s*/, '').trim(),
          content: currentContent.join('\n').trim(),
          id: Math.random().toString(36).substring(7)
        });
      }
      currentTitle = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });

  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle.replace(/^#+\s*/, '').trim(),
      content: currentContent.join('\n').trim(),
      id: Math.random().toString(36).substring(7)
    });
  }

  return sections;
};

// --- Components ---

const ResultCard = ({ title, content }: { title: string, content: string }) => {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden mb-6 w-full">
      <div className="px-4 md:px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
        <h3 className="text-sm font-semibold text-zinc-900 break-words">
          {title}
        </h3>
      </div>
      <div className="p-4 md:p-6 prose prose-sm prose-zinc max-w-none prose-headings:font-semibold prose-headings:text-zinc-900 prose-a:text-blue-600 prose-p:leading-relaxed break-words overflow-x-hidden">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [level, setLevel] = useState<string>(LEVELS[2]);
  const [curriculum, setCurriculum] = useState<string>(CURRICULA[0]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('none');
  const language = 'English';
  const [input, setInput] = useState('');
  const [teacherRequest, setTeacherRequest] = useState('');
  const [generateSlides, setGenerateSlides] = useState(false);
  const [generateSlideScript, setGenerateSlideScript] = useState(false);
  
  const [outputSections, setOutputSections] = useState<{title: string, content: string, id: string}[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContactEmail, setShowContactEmail] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const sendMessageToAI = async (userMessage: string) => {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const { getApiKey } = await import("./services/geminiService");
      
      const apiKey = getApiKey();
      if (!apiKey) {
        return "API Key is missing. Please set VITE_GEMINI_API_KEY2 in Vercel Environment Variables.";
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: userMessage,
      });
      return response.text || "No response from AI.";
    } catch (error) {
      console.error("Error:", error);
      return "Error getting response";
    }
  };

  // Student Management State
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', level: LEVELS[2], curriculum: CURRICULA[0] });
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<Student | null>(null);
  
  // Generated Content Modal State
  const [studentContentModal, setStudentContentModal] = useState<{title: string, content: string} | null>(null);
  const [isGeneratingStudentContent, setIsGeneratingStudentContent] = useState(false);

  // Chat State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chatSessions.find(c => c.id === activeChatId);
  const chatMessages = activeChat?.messages || [];

  useEffect(() => {
    if (selectedStudentProfile) {
      const updatedProfile = students.find(s => s.id === selectedStudentProfile.id);
      if (updatedProfile) {
        setSelectedStudentProfile(updatedProfile);
      } else {
        setSelectedStudentProfile(null);
      }
    }
  }, [students, selectedStudentProfile?.id]);

  useEffect(() => {
    if (currentPage === 'assistant') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, currentPage]);

  const activePageDef = PAGES.find(p => p.id === currentPage);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await getTeacherProfile(currentUser.uid);
          setTeacherProfile(profile);
          
          const sessions = await getChatSessions(currentUser.uid);
          setChatSessions(sessions);
          if (sessions.length > 0) {
            setActiveChatId(sessions[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch teacher profile or chat history:", error);
          setTeacherProfile(null);
        }
      } else {
        setTeacherProfile(null);
        setStudents([]);
        setChatSessions([]);
        setActiveChatId(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && isAuthReady) {
      const unsubscribe = subscribeToStudents(user.uid, (fetchedStudents) => {
        setStudents(fetchedStudents);
      });
      return () => unsubscribe();
    }
  }, [user, isAuthReady]);

  useEffect(() => {
    setInput('');
    setTeacherRequest('');
    setOutputSections(null);
    setError(null);
    setSelectedStudentId('none');
    setGenerateSlides(false);
    setGenerateSlideScript(false);
  }, [currentPage]);

  const handleSendChatMessage = async (query: string) => {
    if (!query.trim() || !user) return;
    
    let currentChatId = activeChatId;
    let currentSessions = [...chatSessions];
    let currentChat = currentSessions.find(c => c.id === currentChatId);

    const newUserMsg: ChatMessage = { role: 'user', content: query };

    if (!currentChat) {
      currentChatId = Date.now().toString();
      currentChat = {
        id: currentChatId,
        title: query.slice(0, 30) + (query.length > 30 ? '...' : ''),
        updatedAt: new Date().toISOString(),
        messages: [newUserMsg]
      };
      currentSessions = [currentChat, ...currentSessions];
      setActiveChatId(currentChatId);
    } else {
      currentChat.messages = [...currentChat.messages, newUserMsg];
      currentChat.updatedAt = new Date().toISOString();
      // Move to top
      currentSessions = [currentChat, ...currentSessions.filter(c => c.id !== currentChatId)];
    }

    setChatSessions(currentSessions);
    setChatInput('');
    setIsChatLoading(true);
    
    // Save user message to firestore immediately
    await saveChatSession(user.uid, currentChat);
    
    try {
      const response = await sendMessageToAI(query);
      
      const finalSessions = [...currentSessions];
      const activeIdx = finalSessions.findIndex(c => c.id === currentChatId);
      if (activeIdx > -1) {
        finalSessions[activeIdx].messages = [...finalSessions[activeIdx].messages, { role: 'assistant', content: response }];
        finalSessions[activeIdx].updatedAt = new Date().toISOString();
        setChatSessions(finalSessions);
        await saveChatSession(user.uid, finalSessions[activeIdx]);
      }
    } catch (err: any) {
      const finalSessions = [...currentSessions];
      const activeIdx = finalSessions.findIndex(c => c.id === currentChatId);
      if (activeIdx > -1) {
        finalSessions[activeIdx].messages = [...finalSessions[activeIdx].messages, { role: 'assistant', content: `**Error:** ${err.message}` }];
        setChatSessions(finalSessions);
        await saveChatSession(user.uid, finalSessions[activeIdx]);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!user) return;
    const updatedSessions = chatSessions.filter(c => c.id !== chatId);
    setChatSessions(updatedSessions);
    if (activeChatId === chatId) {
      setActiveChatId(updatedSessions.length > 0 ? updatedSessions[0].id : null);
    }
    await deleteChatSession(user.uid, chatId);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !user) return;
    
    const studentData = {
      name: newStudent.name,
      level: newStudent.level,
      curriculum: newStudent.curriculum,
      weaknesses: [],
      notes: ''
    };
    
    try {
      const newId = await addStudent(user.uid, studentData);
      setShowAddStudent(false);
      setNewStudent({ name: '', level: LEVELS[2], curriculum: CURRICULA[0] });
      if (currentPage !== 'students') {
        setSelectedStudentId(newId);
        setLevel(studentData.level);
        setCurriculum(studentData.curriculum);
      }
    } catch (err) {
      console.error("Error adding student:", err);
      alert("Failed to add student.");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !activePageDef?.mode) return;

    setIsLoading(true);
    setError(null);
    setOutputSections(null);

    const studentContext = students.find(s => s.id === selectedStudentId) || null;

    try {
      const response = await generateTeacherResponse(
        activePageDef.mode, 
        input, 
        level, 
        curriculum, 
        language,
        teacherProfile,
        studentContext,
        teacherRequest,
        { generateSlides, generateSlideScript }
      );

      let finalResponse = response;
      let extractedScore = 0;
      let extractedWeaknesses: string[] = [];

      const scoreMatch = finalResponse.match(/\[SCORE:\s*(\d+)\]/i);
      if (scoreMatch) {
        extractedScore = parseInt(scoreMatch[1], 10);
        finalResponse = finalResponse.replace(scoreMatch[0], '');
      }

      const weaknessesMatch = finalResponse.match(/\[WEAKNESSES:\s*(.+?)\]/i);
      if (weaknessesMatch) {
        extractedWeaknesses = weaknessesMatch[1].split(',').map((s: string) => s.trim());
        finalResponse = finalResponse.replace(weaknessesMatch[0], '');
      }

      if (studentContext && (activePageDef.mode === 'correction' || activePageDef.mode === 'score') && user) {
        const newEntry = {
          date: new Date().toISOString(),
          originalText: input,
          score: extractedScore || (studentContext.history.length > 0 ? studentContext.history[studentContext.history.length - 1].score : 0),
          feedback: finalResponse
        };
        const updatedWeaknesses = Array.from(new Set([...studentContext.weaknesses, ...extractedWeaknesses]));
        
        await addWritingEntry(user.uid, studentContext.id, newEntry);
        await updateStudentWeaknesses(user.uid, studentContext.id, updatedWeaknesses);
      }

      const sections = parseMarkdownIntoSections(finalResponse);
      setOutputSections(sections);
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the response.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateStudentContent = async (student: Student, mode: string) => {
    setIsGeneratingStudentContent(true);
    try {
      const response = await generateTeacherResponse(
        mode,
        student.weaknesses.join(', ') || 'General English Practice',
        student.level,
        student.curriculum,
        language,
        teacherProfile,
        student
      );
      
      let finalResponse = response;
      // Clean up any stray tags if they exist
      finalResponse = finalResponse.replace(/\[SCORE:\s*(\d+)\]/gi, '').replace(/\[WEAKNESSES:\s*(.+?)\]/gi, '');
      
      setStudentContentModal({ 
        title: mode === 'smart_practice' ? 'Smart Practice' : mode === 'improvement_plan' ? 'Improvement Plan' : 'Student Report', 
        content: finalResponse 
      });
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate content: ' + err.message);
    } finally {
      setIsGeneratingStudentContent(false);
    }
  };

  const handleCopyAll = () => {
    if (outputSections) {
      const fullText = outputSections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');
      navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-zinc-200 p-8 text-center">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-[0_2px_0_0_#27272a] mx-auto mb-6">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">TutorEngMate AI</h1>
          <p className="text-zinc-500 mb-8">Sign in to access your personalized teaching assistant and student progress tracking.</p>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {authError}
            </div>
          )}

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError('');
              try {
                if (authMode === 'login') {
                  await loginWithEmail(authEmail, authPassword);
                } else {
                  await signupWithEmail(authEmail, authPassword);
                }
              } catch (err: any) {
                setAuthError(err.message || "Authentication failed");
              }
            }}
            className="space-y-4 mb-6 text-left"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
              <input 
                type="email" 
                required 
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" 
                placeholder="you@example.com" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" 
                placeholder="••••••••" 
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium hover:bg-zinc-800 transition-colors shadow-sm"
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-zinc-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={async () => {
              setAuthError('');
              try {
                await signInWithGoogle();
              } catch (err: any) {
                setAuthError(err.message || "Google sign-in failed");
              }
            }}
            className="w-full bg-white border border-zinc-200 text-zinc-900 py-2.5 rounded-lg font-medium hover:bg-zinc-50 transition-colors shadow-sm flex items-center justify-center gap-3 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <p className="text-sm text-zinc-500">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
              className="text-zinc-900 font-medium hover:underline"
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (!teacherProfile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-xl w-full rounded-2xl shadow-xl border border-zinc-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-[0_2px_0_0_#27272a]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Welcome to TutorEngMate AI</h1>
          </div>
          
          <p className="text-zinc-500 mb-8">Let's personalize your experience. This helps the AI adapt its feedback, activities, and lesson plans to your specific teaching context.</p>
          
          <form 
            onInvalid={(e) => {
              e.preventDefault();
              setAuthError("Please fill out all required fields correctly.");
            }}
            onSubmit={async (e) => {
            e.preventDefault();
            setAuthError('');
            setIsLoading(true);
            const formData = new FormData(e.currentTarget);
            const profile: TeacherProfile = {
              name: formData.get('name') as string,
              email: (formData.get('email') as string) || user.email || '',
              country: formData.get('country') as string,
              teachingType: formData.get('teachingType') as string,
              curriculum: formData.get('curriculum') as string,
              levels: (formData.get('levels') as string).split(',').map(s => s.trim()).filter(Boolean),
              skills: (formData.get('skills') as string).split(',').map(s => s.trim()).filter(Boolean)
            };
            try {
              await saveTeacherProfile(user.uid, profile);
              setTeacherProfile(profile);
            } catch (err: any) {
              console.error("Error saving profile", err);
              let msg = err.message || "Failed to save profile. Please check your inputs.";
              try {
                const parsed = JSON.parse(err.message);
                if (parsed.error) msg = parsed.error;
              } catch (e) {}
              setAuthError(msg);
            } finally {
              setIsLoading(false);
            }
          }} className="space-y-5">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                {authError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700">Your Name</label>
                <input name="name" required className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" placeholder="e.g. Mr. Smith" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700">Email</label>
                <input name="email" type="email" defaultValue={user.email || ''} required className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" placeholder="e.g. teacher@school.com" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700">Country</label>
                <input name="country" required className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" placeholder="e.g. Egypt" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700">Teaching Type</label>
                <select name="teachingType" className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none">
                  <option>School</option>
                  <option>Online</option>
                  <option>Private Lessons</option>
                  <option>University</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700">Curriculum</label>
              <select name="curriculum" className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none">
                {CURRICULA.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700">Student Levels (comma separated)</label>
              <input name="levels" required className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" placeholder="e.g. Beginner, Intermediate, A1, B2" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700">Main Skills Taught (comma separated)</label>
              <input name="skills" required className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 outline-none" placeholder="e.g. Writing, Speaking, Grammar" />
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white py-3 rounded-lg font-medium mt-4 hover:bg-zinc-800 transition-colors shadow-[0_4px_0_0_#27272a] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#27272a] active:translate-y-[4px] active:shadow-[0_0px_0_0_#27272a] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_0_#27272a]">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving Profile...</span>
                </div>
              ) : (
                'Start Using TutorEngMate AI'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <motion.div 
      key="dashboard"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Welcome Banner */}
      <div className="bg-zinc-900 rounded-2xl p-8 md:p-10 text-white relative overflow-hidden border border-zinc-800 shadow-lg">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Sparkles className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-semibold mb-3 tracking-tight">Good morning, {teacherProfile.name.split(' ')[0]}.</h1>
          <p className="text-zinc-400 max-w-xl text-sm leading-relaxed mb-8">
            Your AI assistant is ready. Select a tool below to start evaluating student work, generating lesson plans, or building new activities.
          </p>
          
          {/* Quick Ask AI */}
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const query = formData.get('query') as string;
            if (query.trim()) {
              setCurrentPage('assistant');
              handleSendChatMessage(query);
            }
          }} className="flex flex-col sm:flex-row gap-3 max-w-2xl mb-8">
            <input 
              name="query"
              type="text" 
              placeholder="Ask the AI any teaching question..." 
              className="flex-1 bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <button type="submit" className="bg-white text-zinc-900 px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 transition-all shadow-sm whitespace-nowrap">
              Ask AI
            </button>
          </form>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => setCurrentPage('correction')}
              className="w-full sm:w-auto bg-white text-zinc-900 px-5 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 transition-all shadow-[0_4px_0_0_#d4d4d8] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#d4d4d8] active:translate-y-[4px] active:shadow-[0_0px_0_0_#d4d4d8]"
            >
              Start Grading
            </button>
            <button 
              onClick={() => setCurrentPage('lesson')}
              className="w-full sm:w-auto bg-zinc-800 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-all border border-zinc-700 shadow-[0_4px_0_0_#27272a] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#27272a] active:translate-y-[4px] active:shadow-[0_0px_0_0_#27272a]"
            >
              Plan a Lesson
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Students Tracked', value: students.length.toString(), trend: 'Active profiles' },
          { label: 'Total Evaluations', value: students.reduce((acc, s) => acc + s.history.length, 0).toString(), trend: 'Across all students' },
          { label: 'Time Saved', value: '45h', trend: 'Estimated' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <p className="text-sm font-medium text-zinc-500 mb-4">{stat.label}</p>
            <div className="flex items-baseline gap-3">
              <h3 className="text-3xl font-semibold text-zinc-900 tracking-tight">{stat.value}</h3>
              <span className="text-xs font-medium text-zinc-400">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Core Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PAGES.filter(p => p.id !== 'dashboard' && p.id !== 'settings' && p.id !== 'students').map((page) => (
            <button
              key={page.id}
              onClick={() => setCurrentPage(page.id)}
              className="flex flex-col items-start p-6 bg-white border-2 border-zinc-200 rounded-2xl transition-all text-left group shadow-[0_5px_0_0_#e4e4e7] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#d4d4d8] hover:border-zinc-300 active:translate-y-[5px] active:shadow-[0_0px_0_0_#d4d4d8]"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-zinc-50 to-zinc-100 border border-zinc-200 shadow-[0_3px_0_0_#e4e4e7] flex items-center justify-center text-zinc-700 mb-5 group-hover:from-zinc-800 group-hover:to-zinc-900 group-hover:text-white group-hover:border-zinc-900 group-hover:shadow-[0_3px_0_0_#27272a] transition-all">
                {page.icon}
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1.5">{page.label}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{page.description}</p>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderStudentsPage = () => {
    if (selectedStudentProfile) {
      return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
          <button onClick={() => setSelectedStudentProfile(null)} className="text-sm text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Students
          </button>
          
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">{selectedStudentProfile.name}</h2>
                <p className="text-sm text-zinc-500 mt-1">{selectedStudentProfile.level} • {selectedStudentProfile.curriculum}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-500">Total Entries</p>
                <p className="text-2xl font-semibold text-zinc-900">{selectedStudentProfile.history.length}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">Progress History</h3>
                {selectedStudentProfile.history.length > 0 ? (
                  <div className="h-64 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedStudentProfile.history.map((h, i) => ({ name: `Entry ${i+1}`, score: h.score }))}>
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="score" stroke="#18181b" strokeWidth={2} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 text-sm">
                    No writing history yet.
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">Top Weaknesses</h3>
                <div className="flex flex-wrap gap-2 mb-8">
                  {selectedStudentProfile.weaknesses.map((w, i) => (
                    <span key={i} className="bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-md border border-red-100">{w}</span>
                  ))}
                  {selectedStudentProfile.weaknesses.length === 0 && <span className="text-sm text-zinc-500">No weaknesses detected yet.</span>}
                </div>
                
                <h3 className="text-sm font-semibold text-zinc-900 mb-4">AI Actions</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleGenerateStudentContent(selectedStudentProfile, 'smart_practice')} 
                    disabled={isGeneratingStudentContent}
                    className="w-full flex items-center justify-between p-4 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3"><PenTool className="w-4 h-4 text-zinc-400" /> Smart Practice Generator</span>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => handleGenerateStudentContent(selectedStudentProfile, 'improvement_plan')} 
                    disabled={isGeneratingStudentContent}
                    className="w-full flex items-center justify-between p-4 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3"><TrendingUp className="w-4 h-4 text-zinc-400" /> 2-Week Improvement Plan</span>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => handleGenerateStudentContent(selectedStudentProfile, 'student_report')} 
                    disabled={isGeneratingStudentContent}
                    className="w-full flex items-center justify-between p-4 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3"><FileText className="w-4 h-4 text-zinc-400" /> AI Student Report</span>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Student Management</h2>
            <p className="text-sm text-zinc-500 mt-1">Track progress and generate personalized plans.</p>
          </div>
          <button onClick={() => setShowAddStudent(true)} className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-[0_3px_0_0_#27272a] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#27272a] active:translate-y-[3px] active:shadow-[0_0px_0_0_#27272a] transition-all">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        </div>
        
        {students.length === 0 && !showAddStudent && (
          <div className="text-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl">
            <Users className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No students added yet.</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {students.map(student => (
            <div key={student.id} className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm cursor-pointer hover:border-zinc-300 hover:shadow-md transition-all group" onClick={() => setSelectedStudentProfile(student)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">{student.name}</h3>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <p className="text-sm text-zinc-500">{student.level} • {student.curriculum}</p>
              <div className="mt-6 flex items-center gap-2">
                <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md">{student.history.length} Entries</span>
                {student.history.length > 0 && (
                  <span className="text-xs font-medium bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">Latest Score: {student.history[student.history.length - 1].score}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAssistantChat = () => (
    <motion.div 
      key="assistant"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="h-full flex flex-col md:flex-row gap-4 max-w-6xl mx-auto"
    >
      {/* Sidebar for Chat History */}
      <div className="w-full md:w-64 bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col overflow-hidden shrink-0 h-48 md:h-auto">
        <div className="p-4 border-b border-zinc-200">
          <button 
            onClick={() => setActiveChatId(null)} 
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {chatSessions.length === 0 ? (
            <div className="text-center p-4 text-zinc-400 text-sm">No recent chats</div>
          ) : (
            chatSessions.map(session => (
              <div 
                key={session.id} 
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${activeChatId === session.id ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`} 
                onClick={() => setActiveChatId(session.id)}
              >
                <div className="truncate text-sm font-medium text-zinc-700">{session.title}</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteChat(session.id); }} 
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-14 border-b border-zinc-200 bg-zinc-50/50 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            <MessageSquare className="w-4 h-4 text-zinc-500 mr-2" />
            <h3 className="text-sm font-semibold text-zinc-900">
              {activeChat ? activeChat.title : 'New Chat'}
            </h3>
          </div>
          {/* Mobile New Chat Button */}
          <button 
            onClick={() => setActiveChatId(null)} 
            className="md:hidden text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {chatMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-100">
                <Sparkles className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-sm text-center max-w-sm">Ask me anything about teaching, lesson planning, classroom management, or how to use this app.</p>
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                msg.role === 'user' 
                  ? 'bg-zinc-900 text-white rounded-br-sm' 
                  : 'bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-bl-sm prose prose-sm prose-zinc max-w-none prose-p:leading-relaxed prose-a:text-blue-600'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage(chatInput);
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="bg-zinc-900 text-white px-5 py-3.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );

  const renderWorkspace = () => (
    <motion.div 
      key={currentPage}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="min-h-full lg:h-full flex flex-col lg:flex-row gap-6"
    >
      {/* Left Column: Configuration & Input */}
      <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 flex-1 flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{activePageDef?.label}</h2>
            <p className="text-sm text-zinc-500 mt-1">{activePageDef?.description}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
            {activePageDef?.id !== 'assistant' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Student (Optional)</label>
                  <select 
                    value={selectedStudentId} 
                    onChange={(e) => {
                      if (e.target.value === 'add_new') {
                        setShowAddStudent(true);
                        // Keep the current selection until the new student is saved
                      } else {
                        setSelectedStudentId(e.target.value);
                        if (e.target.value !== 'none') {
                          const s = students.find(st => st.id === e.target.value);
                          if (s) {
                            setLevel(s.level);
                            setCurriculum(s.curriculum);
                          }
                        }
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
                  >
                    <option value="none">No specific student</option>
                    <option value="add_new">+ Add new student</option>
                    {students.length > 0 && (
                      <optgroup label="Previous Students">
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Level</label>
                    <select 
                      value={level} 
                      onChange={(e) => setLevel(e.target.value)}
                      disabled={selectedStudentId !== 'none'}
                      className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all disabled:opacity-50"
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Curriculum</label>
                    <select 
                      value={curriculum} 
                      onChange={(e) => setCurriculum(e.target.value)}
                      disabled={selectedStudentId !== 'none'}
                      className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all disabled:opacity-50"
                    >
                      {CURRICULA.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 flex-1 flex flex-col">
              <label className="text-xs font-semibold text-zinc-700 flex items-center justify-between">
                <span>{activePageDef?.id === 'assistant' ? 'Your Question' : 'Input Content'}</span>
                <span className="text-zinc-400 font-normal">{input.length} chars</span>
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activePageDef?.placeholder}
                className="w-full flex-1 min-h-[200px] bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all resize-none leading-relaxed"
                required
              />
            </div>

            {(activePageDef?.id === 'correction' || activePageDef?.id === 'score') && (
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Teacher Request</span>
                </label>
                <input
                  type="text"
                  value={teacherRequest}
                  onChange={(e) => setTeacherRequest(e.target.value)}
                  placeholder="Ask the AI to generate activities, homework, or analyze weaknesses."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all"
                />
              </div>
            )}

            {activePageDef?.id === 'lesson' && (
              <div className="space-y-3 bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateSlides}
                    onChange={(e) => {
                      setGenerateSlides(e.target.checked);
                      if (!e.target.checked) setGenerateSlideScript(false);
                    }}
                    className="w-4 h-4 text-zinc-900 border-zinc-300 rounded focus:ring-zinc-900"
                  />
                  <span className="text-sm font-medium text-zinc-700">Generate Interactive Presentation Slides</span>
                </label>
                
                {generateSlides && (
                  <label className="flex items-center gap-3 cursor-pointer pl-7">
                    <input
                      type="checkbox"
                      checked={generateSlideScript}
                      onChange={(e) => setGenerateSlideScript(e.target.checked)}
                      className="w-4 h-4 text-zinc-900 border-zinc-300 rounded focus:ring-zinc-900"
                    />
                    <span className="text-sm text-zinc-600">Include downloadable slide script</span>
                  </label>
                )}
              </div>
            )}

            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="leading-relaxed">
                {activePageDef?.id === 'assistant' ? (
                  <><strong>Context Reminder:</strong> The AI will answer your question based on your teaching profile and general best practices.</>
                ) : (
                  <><strong>Context Reminder:</strong> You are teaching {selectedStudentId !== 'none' ? <span className="font-semibold">{students.find(s => s.id === selectedStudentId)?.name} ({level})</span> : <span className="font-semibold">{level} level students</span>} using the <span className="font-semibold">{curriculum}</span>. The AI will automatically adapt this {activePageDef?.label.toLowerCase()} to your context.</>
                )}
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_0_0_#27272a] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#27272a] active:translate-y-[4px] active:shadow-[0_0px_0_0_#27272a]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Output
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px] lg:min-h-0">
        <div className="h-14 border-b border-zinc-200 bg-zinc-50/50 px-6 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-zinc-900">Output Results</h3>
          {outputSections && (
            <button 
              onClick={handleCopyAll}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy All'}
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-zinc-50/30">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          )}

          {!outputSections && !isLoading && !error && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-sm">Configure your parameters and click Generate.</p>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-300 mb-4" />
              <p className="text-sm">Analyzing and generating content...</p>
            </div>
          )}

          {outputSections && !isLoading && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-500 w-full">
              {outputSections.map((section) => (
                <ResultCard 
                  key={section.id} 
                  title={section.title} 
                  content={section.content} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Group pages for sidebar
  const categories = ['Overview', 'Core Tools', 'Content Generation', 'Analytics', 'System'];

  return (
    <div className="h-screen bg-[#FAFAFA] text-zinc-900 font-sans flex overflow-hidden">
      
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* --- Sidebar --- */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0 z-40 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 shrink-0 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-[0_2px_0_0_#27272a]">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-zinc-900 tracking-tight">TutorEngMate AI</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-zinc-400 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
          {categories.map(category => {
            const categoryPages = PAGES.filter(p => p.category === category);
            if (categoryPages.length === 0) return null;
            
            return (
              <div key={category} className="mb-6">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">
                  {category}
                </h4>
                <div className="space-y-0.5">
                  {categoryPages.map((page) => {
                    const isActive = currentPage === page.id;
                    return (
                      <button
                        key={page.id}
                        onClick={() => {
                          setCurrentPage(page.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-zinc-100 text-zinc-900' 
                            : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                        }`}
                      >
                        <div className={`${isActive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                          {page.icon}
                        </div>
                        {page.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-zinc-200 shrink-0">
          <button onClick={logout} className="w-full flex items-center gap-3 px-2 py-2 hover:bg-zinc-50 rounded-lg transition-colors text-left group">
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-zinc-900 truncate">{teacherProfile?.name || 'Teacher'}</p>
              <p className="text-xs text-zinc-500 truncate group-hover:text-red-600 transition-colors">Sign Out</p>
            </div>
          </button>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        
        {/* Header */}
        <header className="h-16 px-4 md:px-8 flex items-center justify-between bg-white border-b border-zinc-200 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center text-sm font-medium text-zinc-500">
              <span className="hidden sm:inline text-zinc-400">Application</span>
              <ChevronRight className="hidden sm:inline w-4 h-4 mx-1 text-zinc-300" />
              <span className="text-zinc-900">{activePageDef?.label}</span>
            </div>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowContactEmail(!showContactEmail)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </button>
            
            <AnimatePresence>
              {showContactEmail && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute right-0 mt-2 p-3 bg-zinc-900 text-white text-sm rounded-lg shadow-lg border border-zinc-800 z-50 flex items-center gap-3 whitespace-nowrap"
                >
                  <span className="font-medium">norzeid4@gmail.com</span>
                  <a 
                    href="mailto:norzeid4@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-md transition-colors"
                    title="Send Email"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {currentPage === 'dashboard' ? renderDashboard() : 
             currentPage === 'students' ? renderStudentsPage() : 
             currentPage === 'assistant' ? renderAssistantChat() :
             renderWorkspace()}
          </AnimatePresence>
        </main>
      </div>

      {/* Generated Student Content Modal */}
      <AnimatePresence>
        {showAddStudent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="h-14 border-b border-zinc-200 bg-zinc-50/50 px-6 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold text-zinc-900">New Student Profile</h3>
                <button onClick={() => setShowAddStudent(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Name</label>
                    <input required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900/20 outline-none" placeholder="Student Name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Level</label>
                    <select value={newStudent.level} onChange={e => setNewStudent({...newStudent, level: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900/20 outline-none">
                      {LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700">Curriculum</label>
                    <select value={newStudent.curriculum} onChange={e => setNewStudent({...newStudent, curriculum: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-900/20 outline-none">
                      {CURRICULA.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button type="submit" className="flex-1 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium h-[38px] shadow-[0_3px_0_0_#27272a] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#27272a] active:translate-y-[3px] active:shadow-[0_0px_0_0_#27272a] transition-all">Save Student</button>
                    <button type="button" onClick={() => setShowAddStudent(false)} className="flex-1 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium h-[38px] hover:bg-zinc-50 transition-colors">Cancel</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {studentContentModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="h-14 border-b border-zinc-200 bg-zinc-50/50 px-6 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold text-zinc-900">{studentContentModal.title}</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(studentContentModal.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => setStudentContentModal(null)} className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar prose prose-sm prose-zinc max-w-none prose-headings:font-semibold prose-headings:text-zinc-900 prose-a:text-blue-600">
                <ReactMarkdown>{studentContentModal.content}</ReactMarkdown>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
