import { create } from "zustand";

interface TimerState {
  elapsedSeconds: number;
  isRunning: boolean;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  elapsedSeconds: 0,
  isRunning: false,
  startTimer: () => set({ isRunning: true }),
  stopTimer: () => set({ isRunning: false }),
  resetTimer: () => set({ elapsedSeconds: 0, isRunning: false }),
  tick: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
}));
