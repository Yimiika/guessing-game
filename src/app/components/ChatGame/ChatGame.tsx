import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://guessing-game-o6ly.onrender.com';

interface Player {
  id: string;
  name: string;
  role: string;
  score: number;
  attemptsLeft: number;
}

interface GameSession {
  id: string;
  gameMaster: Player;
  players: Player[];
  question: string | null;
  started: boolean;
  winner: Player | null;
  expiresAt: number | null;
}

const ChatGame: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [guess, setGuess] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [isGameMaster, setIsGameMaster] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    s.on('session-update', (data) => {
      setSession(data);
      if (data && data.players) {
        const me = data.players.find((p: Player) => p.name === name && p.id === s.id);
        setIsGameMaster(me?.role === 'game-master');
        setAttemptsLeft(me?.attemptsLeft ?? 3);
      }
    });
    s.on('game-started', ({ question }) => {
      setGameStarted(true);
      setQuestion(question);
      setMessages((msgs) => [...msgs, 'Game started!']);
      setWinner(null);
      setGameEnded(false);
      setRevealedAnswer(null);
    });
    s.on('game-ended', ({ answer, winner }) => {
      setGameEnded(true);
      setRevealedAnswer(answer);
      setWinner(winner);
      setMessages((msgs) => [
        ...msgs,
        winner ? `Winner: ${winner.name}` : 'No winner!',
        `Answer: ${answer}`
      ]);
      setGameStarted(false);
    });
    return () => {
      s.disconnect();
    };
  }, [name]);

  const handleCreateSession = () => {
    if (!socket || !name) return;
    socket.emit('create-session', { name }, ({ sessionId }) => {
      setSessionId(sessionId);
      setJoined(true);
      setIsGameMaster(true);
      setMessages([`Session created. Share this code: ${sessionId}`]);
    });
  };

  const handleJoinSession = () => {
    if (!socket || !name || !sessionId) return;
    socket.emit('join-session', { sessionId, name }, ({ success, error }) => {
      if (success) {
        setJoined(true);
        setIsGameMaster(false);
        setMessages([`Joined session: ${sessionId}`]);
      } else {
        setMessages([error || 'Failed to join session.']);
      }
    });
  };

  const handleStartGame = () => {
    if (!socket || !sessionId || !question || !answer) return;

    socket.emit('start-game', { sessionId, question, answer }, ({ success, error }) => {
      if (!success) setMessages((msgs) => [...msgs, error || 'Could not start game.']);
    });
  };

  const handleGuess = () => {
    if (!socket || !sessionId || !guess) return;
    socket.emit('guess', { sessionId, guess }, ({ success, correct, attemptsLeft }) => {
      if (success) {
        setMessages((msgs) => [...msgs, `You guessed: ${guess} (${correct ? 'Correct!' : 'Wrong!'})`]);
        setGuess('');
        setAttemptsLeft(attemptsLeft ?? attemptsLeft);
      }
    });
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
      <h2>Guessing Game</h2>
      {!joined && (
        <div>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ margin: '8px 0' }}>
            <button onClick={handleCreateSession} disabled={!name}>Create Session</button>
            <span style={{ margin: '0 8px' }}>or</span>
            <input
              placeholder="Session code"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              style={{ width: 120 }}
            />
            <button onClick={handleJoinSession} disabled={!name || !sessionId}>Join</button>
          </div>
        </div>
      )}
      {joined && (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong>Session:</strong> {sessionId}
            <br />
            <strong>Players:</strong> {session?.players.map((p) => `${p.name}${p.role === 'game-master' ? ' (GM)' : ''}`).join(', ')}
            <br />
            <strong>Scores:</strong> {session?.players.map((p) => `${p.name}: ${p.score}`).join(', ')}
          </div>
          <div style={{ border: '1px solid #ccc', minHeight: 120, padding: 8, marginBottom: 8 }}>
            {messages.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
          {!gameStarted && isGameMaster && !gameEnded && (
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                style={{ width: '100%', marginBottom: 4 }}
              />
              <input
                placeholder="Answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={{ width: '100%', marginBottom: 4 }}
              />
              <button onClick={handleStartGame} disabled={!question || !answer}>
                Start Game
              </button>
            </div>
          )}
          {gameStarted && !gameEnded && (
            <div>
              <div><strong>Question:</strong> {question}</div>
              <div style={{ margin: '8px 0' }}>
                <input
                  placeholder="Your guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  disabled={attemptsLeft <= 0}
                />
                <button onClick={handleGuess} disabled={!guess || attemptsLeft <= 0}>Guess</button>
                <span style={{ marginLeft: 8 }}>Attempts left: {attemptsLeft}</span>
              </div>
            </div>
          )}
          {gameEnded && (
            <div style={{ marginTop: 8 }}>
              <strong>Game ended.</strong>
              <div>{winner ? `Winner: ${winner.name}` : 'No winner.'}</div>
              <div>Answer: {revealedAnswer}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChatGame;
