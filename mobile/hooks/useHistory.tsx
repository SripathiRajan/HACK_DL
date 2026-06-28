import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessageTurn {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  source?: string;
  suggestions?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageTurn[];
  timestamp: number;
  isStarred?: boolean;
}

interface HistoryContextType {
  sessions: ChatSession[];
  updateSession: (id: string | null, title: string, messages: ChatMessageTurn[]) => string;
  deleteSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  toggleStar: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);
const HISTORY_KEY = '@drivelegal_sessions_v3'; // Bumped version to v3 to ignore old format

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const stored = await AsyncStorage.getItem(HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSessions(parsed);
        }
      } catch (e) {
        console.error('Failed to load sessions', e);
      }
    };
    loadSessions();
  }, []);

  const updateSession = (id: string | null, title: string, messages: ChatMessageTurn[]): string => {
    if (!title || messages.length === 0) return id || '';
    
    let returnedId = id;

    setSessions(prev => {
      let updated: ChatSession[];
      
      if (id) {
        // Update existing
        updated = prev.map(s => s.id === id ? { ...s, messages, timestamp: Date.now() } : s);
      } else {
        // Create new
        const newId = Date.now().toString();
        returnedId = newId;
        const newSession: ChatSession = {
          id: newId,
          title,
          messages,
          timestamp: Date.now(),
        };
        updated = [newSession, ...prev].slice(0, 50); // Keep last 50 full sessions
      }
      
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(e => 
        console.error('Failed to save sessions', e)
      );
      
      return updated;
    });

    return returnedId || '';
  };

  const deleteSession = async (id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(e => 
        console.error('Failed to update sessions after delete', e)
      );
      return updated;
    });
  };

  const renameSession = async (id: string, newTitle: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, title: newTitle } : s);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(e => 
        console.error('Failed to update sessions after rename', e)
      );
      return updated;
    });
  };

  const toggleStar = async (id: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, isStarred: !s.isStarred } : s);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)).catch(e => 
        console.error('Failed to update sessions after star toggle', e)
      );
      return updated;
    });
  };

  const clearHistory = async () => {
    setSessions([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  return (
    <HistoryContext.Provider value={{ sessions, updateSession, deleteSession, renameSession, toggleStar, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
