import express from 'express';
import router from './lib/router';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { createUser, UserRole } from './game/User';
import { gameSessionManager } from './game/GameSession';
import { v4 as uuidv4 } from 'uuid';

const { PORT = 3001 } = process.env;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware that parses json and looks at requests where the Content-Type header matches the type option.
app.use(express.json());

// Serve API requests from the router
app.use('/api', router);

// Serve app production bundle
app.use(express.static('dist/app'));

// Handle client routing, return all requests to the app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'app/index.html'));
});

io.on('connection', (socket) => {
  let currentSessionId: string | null = null;
  let currentUserName: string | null = null;
  let currentRole: UserRole = 'player';

  socket.on('create-session', ({ name }, callback) => {
    const sessionId = uuidv4();
    const user = createUser(socket.id, name, 'game-master');
    gameSessionManager.createSession(sessionId, user);
    currentSessionId = sessionId;
    currentUserName = name;
    currentRole = 'game-master';
    socket.join(sessionId);
    callback({ sessionId });
    io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
  });

  socket.on('join-session', ({ sessionId, name }, callback) => {
    const user = createUser(socket.id, name, 'player');
    const joined = gameSessionManager.joinSession(sessionId, user);
    if (joined) {
      currentSessionId = sessionId;
      currentUserName = name;
      currentRole = 'player';
      socket.join(sessionId);
      callback({ success: true });
      io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
    } else {
      callback({ success: false, error: 'Unable to join session.' });
    }
  });

  socket.on('start-game', ({ sessionId, question, answer }, callback) => {
    const session = gameSessionManager.getSession(sessionId);
    if (!session || session.gameMaster.id !== socket.id || session.players.length < 2) {
      callback({ success: false, error: 'Not authorized or not enough players.' });
      return;
    }
    const started = gameSessionManager.startGame(sessionId, question, answer);
    console.log('Game started:', started);
    if (started) {
      console.log('Game Details:', sessionId, question, answer);
      console.log('Session Details:', session);
      io.to(sessionId).emit('game-started', { question });
      // Set timer for game end
      const timer = setTimeout(() => {
        io.to(sessionId).emit('game-ended', { answer: session.answer, winner: null });
        gameSessionManager.endGame(sessionId);
        io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
      }, 60000);
      gameSessionManager.setTimer(sessionId, timer);
      
      callback({ success: true });
      io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
    } else {
      callback({ success: false, error: 'Game could not be started.' });
    }
  });

  socket.on('guess', ({ sessionId, guess }, callback) => {
    const session = gameSessionManager.getSession(sessionId);
    if (!session || !session.started || !session.answer) {
      callback({ success: false, error: 'Game not in progress.' });
      return;
    }
    const user = session.players.find((u) => u.id === socket.id);
    if (!user || user.attemptsLeft <= 0 || session.winner) {
      callback({ success: false, error: 'No attempts left or game already won.' });
      return;
    }
    if (guess.trim().toLowerCase() === session.answer) {
      gameSessionManager.setWinner(sessionId, socket.id);
      io.to(sessionId).emit('game-ended', { answer: session.answer, winner: user });
      gameSessionManager.endGame(sessionId);
      io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
      callback({ success: true, correct: true });
    } else {
      user.attemptsLeft -= 1;
      io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
      callback({ success: true, correct: false, attemptsLeft: user.attemptsLeft });
    }
  });

  socket.on('leave-session', ({ sessionId }) => {
    gameSessionManager.leaveSession(sessionId, socket.id);
    socket.leave(sessionId);
    io.to(sessionId).emit('session-update', gameSessionManager.getSession(sessionId));
  });

  socket.on('disconnect', () => {
    if (currentSessionId) {
      gameSessionManager.leaveSession(currentSessionId, socket.id);
      io.to(currentSessionId).emit('session-update', gameSessionManager.getSession(currentSessionId));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
