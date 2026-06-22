# 101 Stats

A mobile stats tracker for **101 Okey** (a Turkish rummy-style tile game), built with Expo Router and a local SQLite database. Track rooms, players, games, and hands, with a detailed scoring engine that mirrors the house rules players actually use at the table.

## Features

- **Rooms & players** — group your regular players into a room, add as many as you like.
- **Games** — start a new game, pick the two teams once, then log hands one after another without re-selecting teams every time.
- **Fast hand entry** — a step-by-step wizard: did the hand finish, how it finished (normal / okey strike / double-pair finish / unfinished), who won, who finished, what each player opened with, and any penalties.
- **Scoring engine** (`lib/scoring.ts`) — pure functions that compute both team and per-player scores from a hand's inputs:
  - Normal win (-101) vs. double-win finishes (okey vurma / çiften bitme, ×2)
  - "Kafa" (a team that never opened) with its own fixed penalty/bonus values
  - Per-player remaining-tile scoring with pair-opening multipliers
  - Bonus for opening 150+ or 7+ pairs
  - Four penalty types (bad discard, wrong opening, losing your okey, letting a neighbor open off your discard) added on top, per player and per team
- **Hand detail view** — tap any hand to see exactly what each player did and how their score was derived.
- **Stats** — per-room individual and pair leaderboards (total score, average score, win rate, kafa count, etc.), ranked lowest-score-first (lower is better, like golf).

## Tech stack

- [Expo](https://expo.dev) (SDK 54) + [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local persistence
- TypeScript throughout

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `a` / `i` in the terminal for an Android/iOS emulator.

## Project structure

```
app/                       Expo Router screens
  room/[roomId]/           Room detail, stats
    session/[sessionId]/   Game screen (teams + hand list)
      hand/                 New hand wizard, hand detail
lib/
  database.ts              SQLite schema + queries
  scoring.ts                Pure scoring functions (team + individual)
  theme.ts                  Shared color palette
types/
  index.ts                  Shared TypeScript types
```

## Data model

`Room` → `Player`s, and a `Room` → `Session` (a game night) → `Hand`s. Each `Session` has two `SessionPlayer` teams set once at the start. Each `Hand` stores its outcome plus a `HandPlayer` row per player (open type, bonuses, remaining tiles, computed individual score) and zero or more `HandPenalty` rows.
