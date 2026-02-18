import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

import authRoutes from './routes/auth';
import sessionsRoutes from './routes/sessions';
import hearingRoutes from './routes/hearing';
import aiRoutes from './routes/ai';
import githubRoutes from './routes/github';
import milestonesRoutes from './routes/milestones';
import terminalRoutes from './routes/terminal';
import sandboxRoutes from './routes/sandbox';
import certificatesRoutes from './routes/certificates';
import commandsRoutes from './routes/commands';
import { setupTerminalWebSocket } from './lib/terminalWs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/hearing', hearingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/commands', commandsRoutes);

const server = createServer(app);

// Setup WebSocket for terminal sessions
setupTerminalWebSocket(server);

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
