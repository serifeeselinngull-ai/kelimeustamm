import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { modules } from '../data/words';

export const useAppStore = create(
  persist(
    (set, get) => ({
      currentUser: null, // { classId, studentId, name }
      
      // We store progress per user. 
      // usersData[studentId] = { 
      //    unlockedModules: [1], 
      //    moduleProgress: { 1: { completedWords: [] } },
      //    unknownWords: [] 
      // }
      usersData: {},

      login: (classId, studentInfo) => set((state) => {
        const studentId = studentInfo.id;
        const existingData = state.usersData[studentId] || {
          unlockedModules: [1],
          moduleProgress: {},
          unknownWords: []
        };
        return {
          currentUser: { classId, ...studentInfo },
          usersData: {
            ...state.usersData,
            [studentId]: existingData
          }
        };
      }),

      logout: () => set({ currentUser: null }),

      markWord: (moduleId, word, isKnown) => set((state) => {
        const { currentUser, usersData } = state;
        if (!currentUser) return state;

        const studentId = currentUser.id;
        const studentData = usersData[studentId];
        
        let newUnknownWords = [...studentData.unknownWords];
        if (!isKnown) {
          // Add to unknown if not already there
          if (!newUnknownWords.find(w => w.id === word.id)) {
            newUnknownWords.push(word);
          }
        } else {
          // If known, maybe remove from unknown? 
          // Requirements say "bilmediklerini sistem bilmiyor diye bir yere kaydedecek." 
          // Doesn't strictly say it removes if they know it later in module view, but let's allow removal from unknown words list when practiced later.
          // For now, if marked known in module view, we remove it from unknown if it was there by mistake.
          newUnknownWords = newUnknownWords.filter(w => w.id !== word.id);
        }

        const currentModuleProgress = studentData.moduleProgress[moduleId] || { completedWords: [] };
        let newCompletedWords = [...currentModuleProgress.completedWords];
        if (!newCompletedWords.includes(word.id)) {
          newCompletedWords.push(word.id);
        }

        // Check if module is finished
        const moduleWordCount = modules.find(m => m.id === moduleId).words.length;
        const isModuleFinished = newCompletedWords.length === moduleWordCount;
        
        let newUnlockedModules = [...studentData.unlockedModules];
        if (isModuleFinished && !newUnlockedModules.includes(moduleId + 1) && moduleId < 8) {
          newUnlockedModules.push(moduleId + 1);
        }

        return {
          usersData: {
            ...usersData,
            [studentId]: {
              ...studentData,
              unknownWords: newUnknownWords,
              unlockedModules: newUnlockedModules,
              moduleProgress: {
                ...studentData.moduleProgress,
                [moduleId]: { completedWords: newCompletedWords }
              }
            }
          }
        };
      }),

      removeUnknownWord: (wordId) => set((state) => {
        const { currentUser, usersData } = state;
        if (!currentUser) return state;

        const studentId = currentUser.id;
        const studentData = usersData[studentId];

        return {
          usersData: {
            ...usersData,
            [studentId]: {
              ...studentData,
              unknownWords: studentData.unknownWords.filter(w => w.id !== wordId)
            }
          }
        };
      })

    }),
    {
      name: 'vocab-app-storage',
    }
  )
);
