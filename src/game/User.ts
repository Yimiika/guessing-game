export type UserRole = 'game-master' | 'player';

export interface User {
  id: string; // Socket ID
  name: string;
  role: UserRole;
  score: number;
  attemptsLeft: number;
}

export function createUser(id: string, name: string, role: UserRole): User {
  return {
    id,
    name,
    role,
    score: 0,
    attemptsLeft: 3,
  };
}
