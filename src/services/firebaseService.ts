import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { TeacherProfile, Student, WritingEntry, ChatSession } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getTeacherProfile = async (uid: string): Promise<TeacherProfile | null> => {
  const path = `teachers/${uid}`;
  try {
    const docRef = doc(db, 'teachers', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        levels: data.levels || [],
        skills: data.skills || []
      } as TeacherProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveTeacherProfile = async (uid: string, profile: TeacherProfile) => {
  const path = `teachers/${uid}`;
  try {
    await setDoc(doc(db, 'teachers', uid), profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToStudents = (uid: string, callback: (students: Student[]) => void) => {
  const path = `teachers/${uid}/students`;
  const q = query(collection(db, path));
  return onSnapshot(q, (snapshot) => {
    const students: Student[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      students.push({ 
        id: doc.id, 
        ...data,
        history: data.history || [],
        weaknesses: data.weaknesses || []
      } as Student);
    });
    callback(students);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addStudent = async (uid: string, studentData: Omit<Student, 'id' | 'history'>) => {
  const path = `teachers/${uid}/students`;
  try {
    const docRef = await addDoc(collection(db, path), {
      ...studentData,
      history: []
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const addWritingEntry = async (uid: string, studentId: string, entry: WritingEntry) => {
  const path = `teachers/${uid}/students/${studentId}`;
  try {
    const studentRef = doc(db, 'teachers', uid, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const student = studentSnap.data() as Student;
      await updateDoc(studentRef, {
        history: [...(student.history || []), entry]
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const updateStudentWeaknesses = async (uid: string, studentId: string, weaknesses: string[]) => {
  const path = `teachers/${uid}/students/${studentId}`;
  try {
    const studentRef = doc(db, 'teachers', uid, 'students', studentId);
    await updateDoc(studentRef, { weaknesses });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getChatSessions = async (uid: string): Promise<ChatSession[]> => {
  const path = `teachers/${uid}/chats`;
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
  return new Promise((resolve, reject) => {
    onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({ id: doc.id, ...data, messages: data.messages || [] } as ChatSession);
      });
      resolve(sessions);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        reject(e);
      }
    });
  });
};

export const saveChatSession = async (uid: string, session: ChatSession) => {
  const path = `teachers/${uid}/chats/${session.id}`;
  try {
    await setDoc(doc(db, 'teachers', uid, 'chats', session.id), session);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteChatSession = async (uid: string, sessionId: string) => {
  const path = `teachers/${uid}/chats/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'teachers', uid, 'chats', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
