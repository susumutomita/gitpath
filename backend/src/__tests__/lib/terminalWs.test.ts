import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const {
  mockRedis, mockPrisma, mockVerifyToken, mockPtyProcesses,
  mockValidateCommand, mockHandleUpgrade, wssInstances,
} = vi.hoisted(() => {
  const wssInstances: any[] = [];
  const mockHandleUpgrade = vi.fn();
  return {
    mockRedis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    },
    mockPrisma: {
      terminalSession: { findUnique: vi.fn(), update: vi.fn() },
      commandLog: { create: vi.fn() },
    },
    mockVerifyToken: vi.fn(),
    mockPtyProcesses: new Map(),
    mockValidateCommand: vi.fn().mockReturnValue({ allowed: true, reason: null }),
    mockHandleUpgrade,
    wssInstances,
  };
});

vi.mock('../../lib/redis', () => ({ redis: mockRedis }));
vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/jwt', () => ({ verifyToken: mockVerifyToken }));
vi.mock('../../routes/terminal', () => ({ ptyProcesses: mockPtyProcesses }));
vi.mock('../../routes/commands', () => ({ validateCommand: mockValidateCommand }));

vi.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require('events');
  class MockWSS extends EE {
    handleUpgrade = mockHandleUpgrade;
    constructor(_opts: any) {
      super();
      wssInstances.push(this);
    }
  }
  return {
    WebSocketServer: MockWSS,
    WebSocket: { OPEN: 1 },
  };
});

import { setupTerminalWebSocket } from '../../lib/terminalWs';

function createMockSocket() {
  const socket = new EventEmitter();
  (socket as any).destroy = vi.fn();
  (socket as any).write = vi.fn();
  return socket;
}

function createMockWs() {
  const ws = new EventEmitter();
  (ws as any).send = vi.fn();
  (ws as any).close = vi.fn();
  (ws as any).readyState = 1;
  return ws;
}

function createMockPty() {
  const dataCallbacks: Function[] = [];
  const exitCallbacks: Function[] = [];
  return {
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn((cb: Function) => {
      dataCallbacks.push(cb);
      return { dispose: vi.fn() };
    }),
    onExit: vi.fn((cb: Function) => {
      exitCallbacks.push(cb);
      return { dispose: vi.fn() };
    }),
    _emitData: (data: string) => dataCallbacks.forEach(cb => cb(data)),
    _emitExit: (exitCode: number) => exitCallbacks.forEach(cb => cb({ exitCode })),
  };
}

describe('setupTerminalWebSocket', () => {
  let mockServer: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPtyProcesses.clear();
    wssInstances.length = 0;
    mockServer = new EventEmitter();
  });

  it('HTTPサーバーにupgradeリスナーを設定する', () => {
    setupTerminalWebSocket(mockServer as any);
    expect(mockServer.listenerCount('upgrade')).toBeGreaterThan(0);
  });

  describe('upgrade handler', () => {
    it('無効なパスの場合ソケットを破棄する', () => {
      setupTerminalWebSocket(mockServer as any);
      const socket = createMockSocket();
      mockServer.emit('upgrade', { url: '/invalid-path', headers: { host: 'localhost' } }, socket, Buffer.alloc(0));
      expect((socket as any).destroy).toHaveBeenCalled();
    });

    it('トークンがない場合401を返す', () => {
      setupTerminalWebSocket(mockServer as any);
      const socket = createMockSocket();
      mockServer.emit('upgrade', { url: '/ws/terminal/abc-123', headers: { host: 'localhost' } }, socket, Buffer.alloc(0));
      expect((socket as any).write).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
      expect((socket as any).destroy).toHaveBeenCalled();
    });

    it('無効なトークンの場合401を返す', () => {
      setupTerminalWebSocket(mockServer as any);
      mockVerifyToken.mockImplementation(() => { throw new Error('invalid'); });
      const socket = createMockSocket();
      mockServer.emit('upgrade', { url: '/ws/terminal/abc-123?token=bad', headers: { host: 'localhost' } }, socket, Buffer.alloc(0));
      expect((socket as any).write).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
      expect((socket as any).destroy).toHaveBeenCalled();
    });

    it('有効なトークンの場合handleUpgradeを呼ぶ', () => {
      setupTerminalWebSocket(mockServer as any);
      mockVerifyToken.mockReturnValue({ userId: 'user-1' });
      const socket = createMockSocket();
      const head = Buffer.alloc(0);
      const request = { url: '/ws/terminal/abc-123?token=valid', headers: { host: 'localhost' } };
      mockServer.emit('upgrade', request, socket, head);
      expect(mockHandleUpgrade).toHaveBeenCalledWith(request, socket, head, expect.any(Function));
    });
  });

  describe('connection handler', () => {
    function getWss() {
      setupTerminalWebSocket(mockServer as any);
      return wssInstances[wssInstances.length - 1];
    }

    it('Redisにセッションがない場合接続を閉じる', async () => {
      const wss = getWss();
      mockRedis.get.mockResolvedValue(null);
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).close).toHaveBeenCalledWith(4004, 'Terminal session not found');
      });
    });

    it('ユーザーIDが一致しない場合接続を閉じる', async () => {
      const wss = getWss();
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'other-user' }));
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).close).toHaveBeenCalledWith(4003, 'Unauthorized');
      });
    });

    it('ptyプロセスがない場合接続を閉じる', async () => {
      const wss = getWss();
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'user-1' }));
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).close).toHaveBeenCalledWith(4004, 'Terminal process not found');
      });
    });

    it('再接続回数上限を超えた場合接続を閉じる', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('3');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).close).toHaveBeenCalledWith(4029, 'Max reconnections exceeded');
      });
    });

    it('正常接続でreadyメッセージを送信する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
    });

    it('pty出力をWebSocketに転送する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => { expect(mockPty.onData).toHaveBeenCalled(); });
      mockPty._emitData('hello world');
      expect((ws as any).send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'output', data: 'hello world' })
      );
    });

    it('inputメッセージをptyに転送する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      mockValidateCommand.mockReturnValue({ allowed: true, reason: null });
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'input', data: 'ls\r' })));
      await vi.waitFor(() => { expect(mockPty.write).toHaveBeenCalledWith('ls\r'); });
    });

    it('ブロックされたコマンドを拒否する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      mockPrisma.terminalSession.findUnique.mockResolvedValue({ id: 'term-1', learningSessionId: 'session-1' });
      mockPrisma.commandLog.create.mockResolvedValue({});
      mockValidateCommand.mockReturnValue({ allowed: false, reason: '危険なコマンドです' });
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'input', data: 'sudo rm -rf /\r' })));
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(expect.stringContaining('"type":"blocked"'));
      });
      expect(mockPty.write).not.toHaveBeenCalled();
    });

    it('resizeメッセージでptyをリサイズする', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'resize', cols: 120, rows: 40 })));
      await vi.waitFor(() => { expect(mockPty.resize).toHaveBeenCalledWith(120, 40); });
    });

    it('pingメッセージにpongで応答する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'ping' })));
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
      });
    });

    it('pty終了時にexitメッセージを送信する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => { expect(mockPty.onExit).toHaveBeenCalled(); });
      mockPty._emitExit(0);
      expect((ws as any).send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'exit', exitCode: 0 })
      );
      expect((ws as any).close).toHaveBeenCalledWith(1000, 'Process exited');
    });

    it('WebSocket切断時にハンドラーを破棄する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => { expect(mockPty.onData).toHaveBeenCalled(); });
      ws.emit('close');
      const onDataDispose = mockPty.onData.mock.results[0].value;
      expect(onDataDispose.dispose).toHaveBeenCalled();
    });

    it('不正なJSONメッセージを無視する', async () => {
      const wss = getWss();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce('0');
      mockRedis.set.mockResolvedValue('OK');
      const mockPty = createMockPty();
      mockPtyProcesses.set('term-1', mockPty as any);
      mockPrisma.terminalSession.update.mockResolvedValue({});
      const ws = createMockWs();
      wss.emit('connection', ws, {}, { terminalSessionId: 'term-1', userId: 'user-1' });
      await vi.waitFor(() => {
        expect((ws as any).send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'ready', terminalSessionId: 'term-1' })
        );
      });
      ws.emit('message', Buffer.from('not-json'));
      expect(mockPty.write).not.toHaveBeenCalled();
    });
  });
});

describe('パスパターンマッチング', () => {
  it('正しいパスパターンにマッチする', () => {
    const pattern = /^\/ws\/terminal\/([a-f0-9-]+)$/;
    expect(pattern.test('/ws/terminal/abc-123')).toBe(true);
    expect(pattern.test('/ws/terminal/550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(pattern.test('/ws/other/abc-123')).toBe(false);
    expect(pattern.test('/ws/terminal/')).toBe(false);
  });
});
