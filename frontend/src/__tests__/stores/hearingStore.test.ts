import { describe, it, expect, beforeEach } from 'vitest';
import { useHearingStore } from '@/stores/hearingStore';

const initialState = useHearingStore.getState();

beforeEach(() => {
  useHearingStore.setState(initialState, true);
});

describe('hearingStore', () => {
  describe('初期状態', () => {
    it('answersが空オブジェクトである', () => {
      expect(useHearingStore.getState().answers).toEqual({});
    });

    it('currentQuestionが0である', () => {
      expect(useHearingStore.getState().currentQuestion).toBe(0);
    });
  });

  describe('setAnswer', () => {
    it('回答を追加できる', () => {
      useHearingStore.getState().setAnswer('q1', 'Yes');
      expect(useHearingStore.getState().answers['q1']).toBe('Yes');
    });

    it('複数の回答を追加できる', () => {
      useHearingStore.getState().setAnswer('q1', 'Yes');
      useHearingStore.getState().setAnswer('q2', 'No');
      expect(useHearingStore.getState().answers).toEqual({ q1: 'Yes', q2: 'No' });
    });

    it('同じ質問の回答を上書きできる', () => {
      useHearingStore.getState().setAnswer('q1', 'Yes');
      useHearingStore.getState().setAnswer('q1', 'No');
      expect(useHearingStore.getState().answers['q1']).toBe('No');
    });
  });

  describe('setCurrentQuestion', () => {
    it('現在の質問インデックスを変更できる', () => {
      useHearingStore.getState().setCurrentQuestion(3);
      expect(useHearingStore.getState().currentQuestion).toBe(3);
    });
  });

  describe('resetHearing', () => {
    it('リセット後にanswersが空になる', () => {
      useHearingStore.getState().setAnswer('q1', 'Yes');
      useHearingStore.getState().setAnswer('q2', 'No');
      useHearingStore.getState().resetHearing();
      expect(useHearingStore.getState().answers).toEqual({});
    });

    it('リセット後にcurrentQuestionが0になる', () => {
      useHearingStore.getState().setCurrentQuestion(5);
      useHearingStore.getState().resetHearing();
      expect(useHearingStore.getState().currentQuestion).toBe(0);
    });
  });
});
