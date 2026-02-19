import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '@/stores/sessionStore';

const initialState = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState(initialState, true);
});

describe('sessionStore', () => {
  describe('初期状態', () => {
    it('sessionIdがnullである', () => {
      expect(useSessionStore.getState().sessionId).toBeNull();
    });

    it('hearingSessionIdがnullである', () => {
      expect(useSessionStore.getState().hearingSessionId).toBeNull();
    });

    it('currentStepが"hearing"である', () => {
      expect(useSessionStore.getState().currentStep).toBe('hearing');
    });

    it('accumulatedSecondsが0である', () => {
      expect(useSessionStore.getState().accumulatedSeconds).toBe(0);
    });

    it('milestonesが空配列である', () => {
      expect(useSessionStore.getState().milestones).toEqual([]);
    });

    it('curriculumがnullである', () => {
      expect(useSessionStore.getState().curriculum).toBeNull();
    });

    it('isResumedがfalseである', () => {
      expect(useSessionStore.getState().isResumed).toBe(false);
    });
  });

  describe('setSessionId', () => {
    it('sessionIdを設定できる', () => {
      useSessionStore.getState().setSessionId('session-123');
      expect(useSessionStore.getState().sessionId).toBe('session-123');
    });
  });

  describe('setHearingSessionId', () => {
    it('hearingSessionIdを設定できる', () => {
      useSessionStore.getState().setHearingSessionId('hearing-456');
      expect(useSessionStore.getState().hearingSessionId).toBe('hearing-456');
    });
  });

  describe('setCurrentStep', () => {
    it('currentStepを変更できる', () => {
      useSessionStore.getState().setCurrentStep('learning');
      expect(useSessionStore.getState().currentStep).toBe('learning');
    });
  });

  describe('addAccumulatedSeconds', () => {
    it('秒数を加算できる', () => {
      useSessionStore.getState().addAccumulatedSeconds(30);
      expect(useSessionStore.getState().accumulatedSeconds).toBe(30);
    });

    it('複数回加算すると累積される', () => {
      useSessionStore.getState().addAccumulatedSeconds(30);
      useSessionStore.getState().addAccumulatedSeconds(45);
      expect(useSessionStore.getState().accumulatedSeconds).toBe(75);
    });
  });

  describe('setMilestones', () => {
    it('マイルストーンを設定できる', () => {
      const milestones = [
        { id: 'm1', name: 'First commit', completed: false },
        { id: 'm2', name: 'Create branch', completed: false },
      ];
      useSessionStore.getState().setMilestones(milestones);
      expect(useSessionStore.getState().milestones).toEqual(milestones);
    });
  });

  describe('completeMilestone', () => {
    it('指定したマイルストーンを完了にできる', () => {
      const milestones = [
        { id: 'm1', name: 'First commit', completed: false },
        { id: 'm2', name: 'Create branch', completed: false },
      ];
      useSessionStore.getState().setMilestones(milestones);
      useSessionStore.getState().completeMilestone('m1');
      expect(useSessionStore.getState().milestones[0].completed).toBe(true);
    });

    it('他のマイルストーンに影響しない', () => {
      const milestones = [
        { id: 'm1', name: 'First commit', completed: false },
        { id: 'm2', name: 'Create branch', completed: false },
      ];
      useSessionStore.getState().setMilestones(milestones);
      useSessionStore.getState().completeMilestone('m1');
      expect(useSessionStore.getState().milestones[1].completed).toBe(false);
    });
  });

  describe('setCurriculum', () => {
    it('カリキュラムを設定できる', () => {
      const curriculum = {
        levelEstimate: 'beginner',
        steps: [
          { stepId: 's1', title: 'Git basics', estimatedMinutes: 10, isSkippable: false },
        ],
        emphasizedConcepts: ['branching'],
        skippedSteps: [],
        personalizedIntro: 'Welcome!',
      };
      useSessionStore.getState().setCurriculum(curriculum);
      expect(useSessionStore.getState().curriculum).toEqual(curriculum);
    });
  });

  describe('setIsResumed', () => {
    it('isResumedをtrueに設定できる', () => {
      useSessionStore.getState().setIsResumed(true);
      expect(useSessionStore.getState().isResumed).toBe(true);
    });
  });

  describe('resetSession', () => {
    it('全てのステートを初期値にリセットする', () => {
      // Arrange: set various state
      useSessionStore.getState().setSessionId('session-123');
      useSessionStore.getState().setHearingSessionId('hearing-456');
      useSessionStore.getState().setCurrentStep('learning');
      useSessionStore.getState().addAccumulatedSeconds(100);
      useSessionStore.getState().setMilestones([
        { id: 'm1', name: 'Test', completed: true },
      ]);
      useSessionStore.getState().setCurriculum({
        levelEstimate: 'beginner',
        steps: [],
        emphasizedConcepts: [],
        skippedSteps: [],
        personalizedIntro: '',
      });
      useSessionStore.getState().setIsResumed(true);

      // Act
      useSessionStore.getState().resetSession();

      // Assert
      const state = useSessionStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.hearingSessionId).toBeNull();
      expect(state.currentStep).toBe('hearing');
      expect(state.accumulatedSeconds).toBe(0);
      expect(state.milestones).toEqual([]);
      expect(state.curriculum).toBeNull();
      expect(state.isResumed).toBe(false);
    });
  });
});
