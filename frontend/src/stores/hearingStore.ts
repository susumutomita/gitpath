import { create } from "zustand";

interface HearingState {
  answers: Record<string, string>;
  currentQuestion: number;
  setAnswer: (questionId: string, answer: string) => void;
  setCurrentQuestion: (index: number) => void;
  resetHearing: () => void;
}

export const useHearingStore = create<HearingState>((set) => ({
  answers: {},
  currentQuestion: 0,
  setAnswer: (questionId, answer) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: answer } })),
  setCurrentQuestion: (index) => set({ currentQuestion: index }),
  resetHearing: () =>
    set({ answers: {}, currentQuestion: 0 }),
}));
