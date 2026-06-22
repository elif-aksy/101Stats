import * as SQLite from 'expo-sqlite';
import {
  computeHandScore,
  computeIndividualScores,
  computePenaltyAmount,
  type PenaltyInput,
  type PlayerHandInput,
} from './scoring';
import type {
  FinishType,
  Hand,
  HandPenalty,
  HandPlayer,
  HandWithDetails,
  PairStat,
  Player,
  PlayerStat,
  Room,
  Session,
  SessionPlayerWithName,
  SessionSummary,
  Team,
} from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('stats101_v2.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team TEXT NOT NULL CHECK (team IN ('team_a', 'team_b'))
    );

    CREATE TABLE IF NOT EXISTS hands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      hand_number INTEGER NOT NULL,
      winning_team TEXT NOT NULL CHECK (winning_team IN ('team_a', 'team_b')),
      finisher_player_id INTEGER NOT NULL REFERENCES players(id),
      finish_type TEXT NOT NULL DEFAULT 'normal'
        CHECK (finish_type IN ('normal', 'okey_vurma', 'cift_bitme', 'unfinished')),
      team_a_score INTEGER NOT NULL DEFAULT 0,
      team_b_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hand_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id),
      open_type TEXT NOT NULL CHECK (open_type IN ('none', 'seri', 'cift')),
      high_open INTEGER NOT NULL DEFAULT 0,
      pair_count_high INTEGER NOT NULL DEFAULT 0,
      remaining_tiles INTEGER NOT NULL DEFAULT 0,
      individual_score INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hand_penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id),
      penalty_type TEXT NOT NULL CHECK (penalty_type IN ('islek_tas', 'yanlis_acma', 'okey_kaptirma', 'tas_alma')),
      tile_value INTEGER,
      taken_open_type TEXT CHECK (taken_open_type IN ('seri', 'cift')),
      amount INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_room ON sessions(room_id);
    CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players(session_id);
    CREATE INDEX IF NOT EXISTS idx_hands_session ON hands(session_id);
    CREATE INDEX IF NOT EXISTS idx_hand_players_hand ON hand_players(hand_id);
    CREATE INDEX IF NOT EXISTS idx_hand_penalties_hand ON hand_penalties(hand_id);
  `);

  await tryAddColumn(database, 'hands', 'finish_type', "TEXT NOT NULL DEFAULT 'normal'");
  await tryAddColumn(database, 'hands', 'team_a_score', 'INTEGER NOT NULL DEFAULT 0');
  await tryAddColumn(database, 'hands', 'team_b_score', 'INTEGER NOT NULL DEFAULT 0');
  await tryAddColumn(database, 'hand_players', 'individual_score', 'INTEGER NOT NULL DEFAULT 0');
  await allowUnfinishedFinishType(database);
}

async function allowUnfinishedFinishType(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'hands'"
  );
  if (!row || row.sql.includes('unfinished')) return;

  await database.execAsync(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE hands_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      hand_number INTEGER NOT NULL,
      winning_team TEXT NOT NULL CHECK (winning_team IN ('team_a', 'team_b')),
      finisher_player_id INTEGER NOT NULL REFERENCES players(id),
      finish_type TEXT NOT NULL DEFAULT 'normal'
        CHECK (finish_type IN ('normal', 'okey_vurma', 'cift_bitme', 'unfinished')),
      team_a_score INTEGER NOT NULL DEFAULT 0,
      team_b_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO hands_new SELECT id, session_id, hand_number, winning_team, finisher_player_id,
      finish_type, team_a_score, team_b_score, created_at FROM hands;
    DROP TABLE hands;
    ALTER TABLE hands_new RENAME TO hands;
    CREATE INDEX IF NOT EXISTS idx_hands_session ON hands(session_id);
    PRAGMA foreign_keys = ON;
  `);
}

async function tryAddColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // column already exists
  }
}

// ---- Rooms ----

export async function createRoom(name: string): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync('INSERT INTO rooms (name) VALUES (?)', [name]);
  return result.lastInsertRowId;
}

export async function getRooms(): Promise<Room[]> {
  const database = await getDatabase();
  return database.getAllAsync<Room>('SELECT id, name, created_at as createdAt FROM rooms ORDER BY created_at DESC');
}

export async function getRoom(roomId: number): Promise<Room | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Room>(
    'SELECT id, name, created_at as createdAt FROM rooms WHERE id = ?',
    [roomId]
  );
  return row ?? null;
}

// ---- Players ----

export async function addPlayer(roomId: number, name: string): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync('INSERT INTO players (room_id, name) VALUES (?, ?)', [roomId, name]);
  return result.lastInsertRowId;
}

export async function getPlayersByRoom(roomId: number): Promise<Player[]> {
  const database = await getDatabase();
  return database.getAllAsync<Player>(
    'SELECT id, room_id as roomId, name, created_at as createdAt FROM players WHERE room_id = ? ORDER BY name',
    [roomId]
  );
}

// ---- Sessions ----

export async function createSession(roomId: number): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync('INSERT INTO sessions (room_id) VALUES (?)', [roomId]);
  return result.lastInsertRowId;
}

export async function getOrCreateActiveSession(roomId: number): Promise<number> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM sessions WHERE room_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
    [roomId]
  );
  if (existing) return existing.id;
  return createSession(roomId);
}

export async function endSession(sessionId: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?", [sessionId]);
}

export async function getSessionsByRoom(roomId: number): Promise<SessionSummary[]> {
  const database = await getDatabase();
  return database.getAllAsync<SessionSummary>(
    `SELECT
       s.id, s.room_id as roomId, s.started_at as startedAt, s.ended_at as endedAt,
       r.name as roomName,
       (SELECT COUNT(*) FROM hands h WHERE h.session_id = s.id) as handCount
     FROM sessions s
     JOIN rooms r ON r.id = s.room_id
     WHERE s.room_id = ?
     ORDER BY s.started_at DESC`,
    [roomId]
  );
}

export async function getSession(sessionId: number): Promise<Session | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Session>(
    'SELECT id, room_id as roomId, started_at as startedAt, ended_at as endedAt FROM sessions WHERE id = ?',
    [sessionId]
  );
  return row ?? null;
}

export async function setSessionPlayers(
  sessionId: number,
  teamA: number[],
  teamB: number[]
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM session_players WHERE session_id = ?', [sessionId]);
  for (const playerId of teamA) {
    await database.runAsync(
      'INSERT INTO session_players (session_id, player_id, team) VALUES (?, ?, ?)',
      [sessionId, playerId, 'team_a']
    );
  }
  for (const playerId of teamB) {
    await database.runAsync(
      'INSERT INTO session_players (session_id, player_id, team) VALUES (?, ?, ?)',
      [sessionId, playerId, 'team_b']
    );
  }
}

export async function getSessionPlayers(sessionId: number): Promise<SessionPlayerWithName[]> {
  const database = await getDatabase();
  return database.getAllAsync<SessionPlayerWithName>(
    `SELECT sp.id, sp.session_id as sessionId, sp.player_id as playerId, sp.team, p.name as playerName
     FROM session_players sp
     JOIN players p ON p.id = sp.player_id
     WHERE sp.session_id = ?`,
    [sessionId]
  );
}

// ---- Hands ----

export interface RecordHandInput {
  sessionId: number;
  finishType: FinishType;
  winningTeam: Team;
  finisherPlayerId: number;
  players: PlayerHandInput[];
  penalties: PenaltyInput[];
}

export async function recordHand(input: RecordHandInput): Promise<number> {
  const database = await getDatabase();
  const lastHand = await database.getFirstAsync<{ maxNumber: number | null }>(
    'SELECT MAX(hand_number) as maxNumber FROM hands WHERE session_id = ?',
    [input.sessionId]
  );
  const handNumber = (lastHand?.maxNumber ?? 0) + 1;

  const { teamAScore, teamBScore } = computeHandScore(input.finishType, input.winningTeam, input.players);
  const individualScores = computeIndividualScores(
    input.finishType,
    input.winningTeam,
    input.finisherPlayerId,
    input.players
  );

  const penaltyAmounts = input.penalties.map((p) => ({ ...p, amount: computePenaltyAmount(p) }));
  let teamAExtra = 0;
  let teamBExtra = 0;
  for (const p of penaltyAmounts) {
    if (p.team === 'team_a') teamAExtra += p.amount;
    else teamBExtra += p.amount;
    individualScores[p.playerId] = (individualScores[p.playerId] ?? 0) + p.amount;
  }

  const result = await database.runAsync(
    `INSERT INTO hands
       (session_id, hand_number, winning_team, finisher_player_id, finish_type, team_a_score, team_b_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sessionId,
      handNumber,
      input.winningTeam,
      input.finisherPlayerId,
      input.finishType,
      teamAScore + teamAExtra,
      teamBScore + teamBExtra,
    ]
  );
  const handId = result.lastInsertRowId;

  for (const p of input.players) {
    await database.runAsync(
      `INSERT INTO hand_players
         (hand_id, player_id, open_type, high_open, pair_count_high, remaining_tiles, individual_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        handId,
        p.playerId,
        p.openType,
        p.highOpen ? 1 : 0,
        p.pairCountHigh ? 1 : 0,
        p.remainingTiles,
        individualScores[p.playerId] ?? 0,
      ]
    );
  }

  for (const p of penaltyAmounts) {
    await database.runAsync(
      `INSERT INTO hand_penalties (hand_id, player_id, penalty_type, tile_value, taken_open_type, amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [handId, p.playerId, p.penaltyType, p.tileValue ?? null, p.takenOpenType ?? null, p.amount]
    );
  }

  return handId;
}

export async function getHandsBySession(sessionId: number): Promise<HandWithDetails[]> {
  const database = await getDatabase();
  return database.getAllAsync<HandWithDetails>(
    `SELECT h.id, h.session_id as sessionId, h.hand_number as handNumber,
            h.winning_team as winningTeam, h.finisher_player_id as finisherPlayerId,
            h.finish_type as finishType, h.team_a_score as teamAScore, h.team_b_score as teamBScore,
            h.created_at as createdAt, p.name as finisherName
     FROM hands h
     JOIN players p ON p.id = h.finisher_player_id
     WHERE h.session_id = ?
     ORDER BY h.hand_number ASC`,
    [sessionId]
  );
}

export async function getHandPlayers(handId: number): Promise<HandPlayer[]> {
  const database = await getDatabase();
  return database.getAllAsync<HandPlayer>(
    `SELECT id, hand_id as handId, player_id as playerId, open_type as openType,
            high_open as highOpen, pair_count_high as pairCountHigh, remaining_tiles as remainingTiles,
            individual_score as individualScore
     FROM hand_players WHERE hand_id = ?`,
    [handId]
  );
}

export async function getHandPenalties(handId: number): Promise<HandPenalty[]> {
  const database = await getDatabase();
  return database.getAllAsync<HandPenalty>(
    `SELECT id, hand_id as handId, player_id as playerId, penalty_type as penaltyType,
            tile_value as tileValue, taken_open_type as takenOpenType, amount
     FROM hand_penalties WHERE hand_id = ?`,
    [handId]
  );
}

export async function deleteHand(handId: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM hands WHERE id = ?', [handId]);
}

export async function getRecentHandsByRoom(roomId: number, limit = 5): Promise<HandWithDetails[]> {
  const database = await getDatabase();
  return database.getAllAsync<HandWithDetails>(
    `SELECT h.id, h.session_id as sessionId, h.hand_number as handNumber,
            h.winning_team as winningTeam, h.finisher_player_id as finisherPlayerId,
            h.finish_type as finishType, h.team_a_score as teamAScore, h.team_b_score as teamBScore,
            h.created_at as createdAt, p.name as finisherName
     FROM hands h
     JOIN sessions s ON s.id = h.session_id
     JOIN players p ON p.id = h.finisher_player_id
     WHERE s.room_id = ?
     ORDER BY h.created_at DESC
     LIMIT ?`,
    [roomId, limit]
  );
}

// ---- Stats ----

export async function getPlayerStats(roomId: number): Promise<PlayerStat[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    playerId: number;
    playerName: string;
    handsPlayed: number;
    wins: number;
    totalScore: number;
    kafaCount: number;
    highOpenCount: number;
    pairHighCount: number;
    lastRemainingTiles: number | null;
  }>(
    `SELECT p.id as playerId, p.name as playerName,
            COUNT(h.id) as handsPlayed,
            SUM(CASE WHEN sp.team = h.winning_team THEN 1 ELSE 0 END) as wins,
            SUM(hp_self.individual_score) as totalScore,
            (SELECT COUNT(*) FROM hand_players hp
               JOIN hands hh ON hh.id = hp.hand_id
               JOIN sessions ss ON ss.id = hh.session_id
             WHERE hp.player_id = p.id AND hp.open_type = 'none' AND ss.room_id = ?) as kafaCount,
            (SELECT COUNT(*) FROM hand_players hp
               JOIN hands hh ON hh.id = hp.hand_id
               JOIN sessions ss ON ss.id = hh.session_id
             WHERE hp.player_id = p.id AND hp.open_type = 'seri' AND hp.high_open = 1 AND ss.room_id = ?) as highOpenCount,
            (SELECT COUNT(*) FROM hand_players hp
               JOIN hands hh ON hh.id = hp.hand_id
               JOIN sessions ss ON ss.id = hh.session_id
             WHERE hp.player_id = p.id AND hp.open_type = 'cift' AND hp.pair_count_high = 1 AND ss.room_id = ?) as pairHighCount,
            (SELECT hp2.remaining_tiles FROM hand_players hp2
               JOIN hands hh2 ON hh2.id = hp2.hand_id
               JOIN sessions ss2 ON ss2.id = hh2.session_id
             WHERE hp2.player_id = p.id AND ss2.room_id = ?
             ORDER BY hh2.created_at DESC LIMIT 1) as lastRemainingTiles
     FROM players p
     JOIN session_players sp ON sp.player_id = p.id
     JOIN sessions s ON s.id = sp.session_id
     JOIN hands h ON h.session_id = s.id
     JOIN hand_players hp_self ON hp_self.hand_id = h.id AND hp_self.player_id = p.id
     WHERE p.room_id = ? AND s.room_id = ?
     GROUP BY p.id
     ORDER BY totalScore ASC`,
    [roomId, roomId, roomId, roomId, roomId, roomId]
  );

  return rows.map((r) => ({
    ...r,
    lastRemainingTiles: r.lastRemainingTiles ?? 0,
    winRate: r.handsPlayed > 0 ? r.wins / r.handsPlayed : 0,
    avgScore: r.handsPlayed > 0 ? r.totalScore / r.handsPlayed : 0,
  }));
}

export async function getPairStats(roomId: number): Promise<PairStat[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    playerAId: number;
    playerAName: string;
    playerBId: number;
    playerBName: string;
    gamesPlayed: number;
    wins: number;
    totalScore: number;
  }>(
    `SELECT sp1.player_id as playerAId, pa.name as playerAName,
            sp2.player_id as playerBId, pb.name as playerBName,
            COUNT(h.id) as gamesPlayed,
            SUM(CASE WHEN sp1.team = h.winning_team THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN sp1.team = 'team_a' THEN h.team_a_score ELSE h.team_b_score END) as totalScore
     FROM session_players sp1
     JOIN session_players sp2 ON sp2.session_id = sp1.session_id
       AND sp2.team = sp1.team AND sp2.player_id > sp1.player_id
     JOIN players pa ON pa.id = sp1.player_id
     JOIN players pb ON pb.id = sp2.player_id
     JOIN sessions s ON s.id = sp1.session_id
     JOIN hands h ON h.session_id = s.id
     WHERE s.room_id = ?
     GROUP BY sp1.player_id, sp2.player_id
     ORDER BY totalScore ASC`,
    [roomId]
  );

  return rows.map((r) => ({
    ...r,
    winRate: r.gamesPlayed > 0 ? r.wins / r.gamesPlayed : 0,
    avgScore: r.gamesPlayed > 0 ? r.totalScore / r.gamesPlayed : 0,
  }));
}
