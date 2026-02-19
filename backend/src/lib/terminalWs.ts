import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyToken } from './jwt';
import { prisma } from './prisma';
import { redis } from './redis';
import { ptyProcesses } from '../routes/terminal';
import { validateCommand } from '../routes/commands';

const MAX_RECONNECT = 3;

export function setupTerminalWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: undefined });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/terminal\/([a-f0-9-]+)$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const terminalSessionId = match[1];

    // Authenticate via query param token
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { terminalSessionId, userId });
    });
  });

  wss.on('connection', async (ws: WebSocket, _request: unknown, context: { terminalSessionId: string; userId: string }) => {
    const { terminalSessionId, userId } = context;

    try {
      // Verify terminal session from Redis
      const sessionData = await redis.get(`terminal:${terminalSessionId}`);
      if (!sessionData) {
        ws.close(4004, 'Terminal session not found');
        return;
      }

      let parsed: { userId: string };
      try {
        parsed = JSON.parse(sessionData);
      } catch {
        ws.close(4004, 'Invalid session data');
        return;
      }
      if (parsed.userId !== userId) {
        ws.close(4003, 'Unauthorized');
        return;
      }

      // Get pty process
      const ptyProcess = ptyProcesses.get(terminalSessionId);
      if (!ptyProcess) {
        ws.close(4004, 'Terminal process not found');
        return;
      }

      // Track reconnection count
      const reconnectKey = `terminal_reconnect:${terminalSessionId}`;
      const reconnectCount = parseInt((await redis.get(reconnectKey)) || '0', 10);

      if (reconnectCount >= MAX_RECONNECT) {
        // Update DB and inform client
        await prisma.terminalSession.update({
          where: { id: terminalSessionId },
          data: { status: 'disconnected', reconnectCount },
        });
        ws.close(4029, 'Max reconnections exceeded');
        return;
      }

      // Increment reconnect count in Redis (TTL 1 hour)
      await redis.set(reconnectKey, String(reconnectCount + 1), 'EX', 3600);

      // Update DB reconnect count
      await prisma.terminalSession.update({
        where: { id: terminalSessionId },
        data: { reconnectCount: reconnectCount + 1, lastActiveAt: new Date(), status: 'active' },
      });

      // Forward pty output to WebSocket
      const dataHandler = ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      const exitHandler = ptyProcess.onExit(({ exitCode }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', exitCode }));
          ws.close(1000, 'Process exited');
        }
      });

      // Handle messages from WebSocket client
      ws.on('message', async (message: Buffer) => {
        try {
          const msg = JSON.parse(message.toString());

          switch (msg.type) {
            case 'input': {
              // Validate command before sending to pty (check on Enter)
              if (msg.data && msg.data.includes('\r')) {
                const cmdLine = (msg.data as string).replace(/\r?\n?$/, '').trim();
                if (cmdLine) {
                  const validation = validateCommand(cmdLine);
                  if (!validation.allowed) {
                    // Block the command and notify client
                    ws.send(JSON.stringify({
                      type: 'blocked',
                      reason: validation.reason,
                      command: cmdLine,
                    }));

                    // Log the blocked command
                    const termSession = await prisma.terminalSession.findUnique({
                      where: { id: terminalSessionId },
                    });
                    if (termSession) {
                      await prisma.commandLog.create({
                        data: {
                          terminalSessionId,
                          learningSessionId: termSession.learningSessionId,
                          commandText: cmdLine,
                          isBlocked: true,
                          blockReason: validation.reason,
                        },
                      });
                    }
                    return;
                  }
                }
              }

              // Forward input to pty
              ptyProcess.write(msg.data);
              break;
            }

            case 'resize': {
              if (msg.cols && msg.rows) {
                ptyProcess.resize(msg.cols, msg.rows);
                await prisma.terminalSession.update({
                  where: { id: terminalSessionId },
                  data: { cols: msg.cols, rows: msg.rows },
                });
              }
              break;
            }

            case 'ping': {
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
            }
          }
        } catch {
          // Ignore malformed messages
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        dataHandler.dispose();
        exitHandler.dispose();
      });

      // Send initial ready message
      ws.send(JSON.stringify({ type: 'ready', terminalSessionId }));
    } catch (err) {
      console.error('WebSocket connection handler error:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(4500, 'Internal server error');
      }
    }
  });
}
