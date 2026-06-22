export type Team = 'team_a' | 'team_b';
export type OpenType = 'none' | 'seri' | 'cift';
export type FinishType = 'normal' | 'okey_vurma' | 'cift_bitme' | 'unfinished';
export type PenaltyType = 'islek_tas' | 'yanlis_acma' | 'okey_kaptirma' | 'tas_alma';

export interface Room {
  id: number;
  name: string;
  createdAt: string;
}

export interface Player {
  id: number;
  roomId: number;
  name: string;
  createdAt: string;
}

export interface Session {
  id: number;
  roomId: number;
  startedAt: string;
  endedAt: string | null;
}

export interface SessionPlayer {
  id: number;
  sessionId: number;
  playerId: number;
  team: Team;
}

export interface Hand {
  id: number;
  sessionId: number;
  handNumber: number;
  winningTeam: Team;
  finisherPlayerId: number;
  finishType: FinishType;
  teamAScore: number;
  teamBScore: number;
  createdAt: string;
}

export interface HandPlayer {
  id: number;
  handId: number;
  playerId: number;
  openType: OpenType;
  highOpen: boolean;
  pairCountHigh: boolean;
  remainingTiles: number;
  individualScore: number;
}

export interface HandPenalty {
  id: number;
  handId: number;
  playerId: number;
  penaltyType: PenaltyType;
  tileValue: number | null;
  takenOpenType: 'seri' | 'cift' | null;
  amount: number;
}

export interface HandWithDetails extends Hand {
  finisherName: string;
}

export interface SessionPlayerWithName extends SessionPlayer {
  playerName: string;
}

export interface SessionSummary extends Session {
  roomName: string;
  handCount: number;
}

export interface PlayerStat {
  playerId: number;
  playerName: string;
  handsPlayed: number;
  wins: number;
  winRate: number;
  totalScore: number;
  avgScore: number;
  kafaCount: number;
  highOpenCount: number;
  pairHighCount: number;
  lastRemainingTiles: number;
}

export interface PairStat {
  playerAId: number;
  playerAName: string;
  playerBId: number;
  playerBName: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalScore: number;
  avgScore: number;
}
