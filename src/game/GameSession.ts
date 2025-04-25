import { User } from './User';

export interface GameSession {
  id: string;
  gameMaster: User;
  players: User[];
  question: string | null;
  answer: string | null;
  started: boolean;
  winner: User | null;
  expiresAt: number | null;
}

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  createSession(sessionId: string, gameMaster: User): GameSession {
    const session: GameSession = {
      id: sessionId,
      gameMaster,
      players: [gameMaster],
      question: null,
      answer: null,
      started: false,
      winner: null,
      expiresAt: null,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  joinSession(sessionId: string, user: User): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.started) return false;
    if (session.players.find((u) => u.id === user.id)) return false;
    session.players.push(user);
    return true;
  }

  leaveSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.players = session.players.filter((u) => u.id !== userId);
    if (session.players.length === 0) {
      this.sessions.delete(sessionId);
    } else if (session.gameMaster.id === userId) {
      // Assign new game master
      session.gameMaster = session.players[0];
      session.gameMaster.role = 'game-master';
    }
  }

  startGame(sessionId: string, question: string, answer: string, duration = 60): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.started || session.players.length < 2) return false;
    session.question = question;
    session.answer = answer.toLowerCase();
    session.started = true;
    session.winner = null;
    session.players.forEach((p) => (p.attemptsLeft = 3));
    session.expiresAt = Date.now() + duration * 1000;
    return true;
  }

  endGame(sessionId: string): void {
    this.clearTimer(sessionId); // Clear any existing timer
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.started = false;
    session.question = null;
    session.answer = null;
    session.winner = null;
    session.expiresAt = null;
  }

  setWinner(sessionId: string, winnerId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const winner = session.players.find((u) => u.id === winnerId);
    if (winner) {
      session.winner = winner;
      winner.score += 10;
    }
  }

  setTimer(sessionId: string, timer: NodeJS.Timeout) {
    this.timers.set(sessionId, timer);
  }

  clearTimer(sessionId: string) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
  }
}

export const gameSessionManager = new GameSessionManager();
