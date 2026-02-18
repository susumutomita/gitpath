import { create } from "zustand";

interface Milestone {
  id: string;
  name: string;
  completed: boolean;
}

interface CurriculumStep {
  stepId: string;
  title: string;
  estimatedMinutes: number;
  isSkippable: boolean;
}

interface Curriculum {
  levelEstimate: string;
  steps: CurriculumStep[];
  emphasizedConcepts: string[];
  skippedSteps: string[];
  personalizedIntro: string;
}

interface SessionState {
  sessionId: string | null;
  hearingSessionId: string | null;
  currentStep: string;
  accumulatedSeconds: number;
  milestones: Milestone[];
  curriculum: Curriculum | null;
  isResumed: boolean;
  setSessionId: (id: string) => void;
  setHearingSessionId: (id: string) => void;
  setCurrentStep: (step: string) => void;
  addAccumulatedSeconds: (seconds: number) => void;
  setMilestones: (milestones: Milestone[]) => void;
  completeMilestone: (id: string) => void;
  setCurriculum: (curriculum: Curriculum) => void;
  setIsResumed: (isResumed: boolean) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  hearingSessionId: null,
  currentStep: "hearing",
  accumulatedSeconds: 0,
  milestones: [],
  curriculum: null,
  isResumed: false,
  setSessionId: (id) => set({ sessionId: id }),
  setHearingSessionId: (id) => set({ hearingSessionId: id }),
  setCurrentStep: (step) => set({ currentStep: step }),
  addAccumulatedSeconds: (seconds) =>
    set((state) => ({ accumulatedSeconds: state.accumulatedSeconds + seconds })),
  setMilestones: (milestones) => set({ milestones }),
  completeMilestone: (id) =>
    set((state) => ({
      milestones: state.milestones.map((m) =>
        m.id === id ? { ...m, completed: true } : m
      ),
    })),
  setCurriculum: (curriculum) => set({ curriculum }),
  setIsResumed: (isResumed) => set({ isResumed }),
  resetSession: () =>
    set({
      sessionId: null,
      hearingSessionId: null,
      currentStep: "hearing",
      accumulatedSeconds: 0,
      milestones: [],
      curriculum: null,
      isResumed: false,
    }),
}));
