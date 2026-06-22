import type { FinishType, OpenType, PenaltyType, Team } from '../types';

export interface PlayerHandInput {
  playerId: number;
  team: Team;
  openType: OpenType;
  highOpen: boolean;
  pairCountHigh: boolean;
  remainingTiles: number;
}

export interface HandScore {
  teamAScore: number;
  teamBScore: number;
  isKafa: boolean;
}

export interface PenaltyInput {
  playerId: number;
  team: Team;
  penaltyType: PenaltyType;
  tileValue?: number;
  takenOpenType?: 'seri' | 'cift';
}

const NORMAL_WIN = -101;
const KAFA_WIN = -202;
const KAFA_LOSS = 808;
const BONUS = -101;
const NO_OPEN_PENALTY = 202;
const FLAT_PENALTY = 101;

export function computePenaltyAmount(p: PenaltyInput): number {
  if (p.penaltyType === 'tas_alma') {
    const value = p.tileValue ?? 0;
    return value * (p.takenOpenType === 'cift' ? 20 : 10);
  }
  return FLAT_PENALTY;
}

function tileContribution(p: PlayerHandInput): number {
  if (p.openType === 'none') return NO_OPEN_PENALTY;
  if (p.openType === 'cift') return p.remainingTiles * (p.pairCountHigh ? 1 : 2);
  return p.remainingTiles;
}

function applyBonuses(players: PlayerHandInput[], teamScores: Record<Team, number>): void {
  for (const p of players) {
    const triggered = (p.openType === 'seri' && p.highOpen) || (p.openType === 'cift' && p.pairCountHigh);
    if (triggered) teamScores[p.team] += BONUS;
  }
}

export function computeHandScore(
  finishType: FinishType,
  winningTeam: Team,
  players: PlayerHandInput[]
): HandScore {
  const teamScores: Record<Team, number> = { team_a: 0, team_b: 0 };

  if (finishType === 'unfinished') {
    for (const p of players) {
      teamScores[p.team] += tileContribution(p);
    }
    applyBonuses(players, teamScores);
    return { teamAScore: teamScores.team_a, teamBScore: teamScores.team_b, isKafa: false };
  }

  const losingTeam: Team = winningTeam === 'team_a' ? 'team_b' : 'team_a';
  const losingPlayers = players.filter((p) => p.team === losingTeam);
  const multiplier = finishType === 'normal' ? 1 : 2;
  const isKafa = losingPlayers.length > 0 && losingPlayers.every((p) => p.openType === 'none');

  if (isKafa) {
    teamScores[winningTeam] = KAFA_WIN * multiplier;
    teamScores[losingTeam] = KAFA_LOSS * multiplier;
  } else {
    teamScores[winningTeam] = NORMAL_WIN * multiplier;
    teamScores[losingTeam] = losingPlayers.reduce((sum, p) => sum + tileContribution(p), 0) * multiplier;
  }

  applyBonuses(players, teamScores);

  return { teamAScore: teamScores.team_a, teamBScore: teamScores.team_b, isKafa };
}

export function computeIndividualScores(
  finishType: FinishType,
  winningTeam: Team,
  finisherPlayerId: number,
  players: PlayerHandInput[]
): Record<number, number> {
  const scores: Record<number, number> = {};

  if (finishType === 'unfinished') {
    for (const p of players) scores[p.playerId] = tileContribution(p);
    return scores;
  }

  const multiplier = finishType === 'normal' ? 1 : 2;
  const losingTeam: Team = winningTeam === 'team_a' ? 'team_b' : 'team_a';
  const losingPlayers = players.filter((p) => p.team === losingTeam);
  const isKafa = losingPlayers.length > 0 && losingPlayers.every((p) => p.openType === 'none');

  for (const p of players) {
    if (p.playerId === finisherPlayerId) {
      scores[p.playerId] = (isKafa ? KAFA_WIN : NORMAL_WIN) * multiplier;
    } else if (isKafa && p.team === losingTeam) {
      scores[p.playerId] = NO_OPEN_PENALTY * 2 * multiplier;
    } else {
      scores[p.playerId] = tileContribution(p);
    }
  }

  return scores;
}
