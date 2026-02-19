import { describe, it, expect, beforeEach } from 'vitest';
import { useTimerStore } from '@/stores/timerStore';

const initialState = useTimerStore.getState();

beforeEach(() => {
  useTimerStore.setState(initialState, true);
});

describe('timerStore', () => {
  describe('初期状態', () => {
    it('elapsedSecondsが0である', () => {
      expect(useTimerStore.getState().elapsedSeconds).toBe(0);
    });

    it('isRunningがfalseである', () => {
      expect(useTimerStore.getState().isRunning).toBe(false);
    });
  });

  describe('startTimer', () => {
    it('タイマーを開始するとisRunningがtrueになる', () => {
      useTimerStore.getState().startTimer();
      expect(useTimerStore.getState().isRunning).toBe(true);
    });

    it('タイマーを開始してもelapsedSecondsは変わらない', () => {
      useTimerStore.getState().startTimer();
      expect(useTimerStore.getState().elapsedSeconds).toBe(0);
    });
  });

  describe('stopTimer', () => {
    it('タイマーを停止するとisRunningがfalseになる', () => {
      useTimerStore.getState().startTimer();
      useTimerStore.getState().stopTimer();
      expect(useTimerStore.getState().isRunning).toBe(false);
    });

    it('タイマーを停止してもelapsedSecondsは保持される', () => {
      useTimerStore.getState().startTimer();
      useTimerStore.getState().tick();
      useTimerStore.getState().tick();
      useTimerStore.getState().stopTimer();
      expect(useTimerStore.getState().elapsedSeconds).toBe(2);
    });
  });

  describe('resetTimer', () => {
    it('リセットするとelapsedSecondsが0になる', () => {
      useTimerStore.getState().tick();
      useTimerStore.getState().tick();
      useTimerStore.getState().resetTimer();
      expect(useTimerStore.getState().elapsedSeconds).toBe(0);
    });

    it('リセットするとisRunningがfalseになる', () => {
      useTimerStore.getState().startTimer();
      useTimerStore.getState().resetTimer();
      expect(useTimerStore.getState().isRunning).toBe(false);
    });
  });

  describe('tick', () => {
    it('tickでelapsedSecondsが1増える', () => {
      useTimerStore.getState().tick();
      expect(useTimerStore.getState().elapsedSeconds).toBe(1);
    });

    it('複数回tickすると累積される', () => {
      useTimerStore.getState().tick();
      useTimerStore.getState().tick();
      useTimerStore.getState().tick();
      expect(useTimerStore.getState().elapsedSeconds).toBe(3);
    });
  });
});
