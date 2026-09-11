/**
 * Development script that fills the games database with simulated finished games,
 * so the stats MCP server has data to show.
 *
 * Usage: npm run seed --workspace=stats-server
 */

import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import Database from 'better-sqlite3'
import {
  TicTacToeGame,
  RockPaperScissorsGame,
  ConnectFourGame,
  GAME_TYPES,
  DIFFICULTIES,
  type BaseGameState,
  type Difficulty,
  type Game,
  type GameMove,
  type GameSession,
  type GameType,
  type Player,
  type PlayerId,
  type RPSChoice,
  type RPSGameState
} from '@turn-based-mcp/shared'

type SeatId = 'player1' | 'ai'
type Skills = Record<SeatId, number>

export type SeedSession = GameSession & { gameType: GameType; difficulty: Difficulty }

export interface SeedOptions {
  gamesPerPlayer?: number
  random?: () => number
  now?: Date
}

/** Simulated players and how often they spot a winning or blocking move */
const SEED_PLAYERS = [
  { name: 'Ana', skill: 0.8 },
  { name: 'Bruno', skill: 0.3 },
  { name: 'Caro', skill: 0.6 },
  { name: 'Dani', skill: 0.5 },
]

/** How often the AI spots a winning or blocking move on each difficulty */
const AI_SKILL: Record<Difficulty, number> = { easy: 0.1, medium: 0.6, hard: 0.95 }

const SEED_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

const RPS_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors']
/** The choice that beats each key */
const BEATEN_BY: Record<RPSChoice, RPSChoice> = { rock: 'paper', paper: 'scissors', scissors: 'rock' }

const TABLES: Record<GameType, string> = {
  'tic-tac-toe': 'tic_tac_toe_games',
  'rock-paper-scissors': 'rps_games',
  'connect-four': 'connect_four_games',
}

const DEFAULT_DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/games.db')

/**
 * Small deterministic pseudo-random generator (mulberry32), so a seed can be reproduced
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Plays complete games between the seed players and the AI using the real game rules.
 * Game types rotate so every type is represented; difficulty and dates are random.
 */
export function simulateSessions({ gamesPerPlayer = 10, random = Math.random, now = new Date() }: SeedOptions = {}): SeedSession[] {
  const sessions: SeedSession[] = []

  for (const seedPlayer of SEED_PLAYERS) {
    for (let i = 0; i < gamesPerPlayer; i++) {
      const gameType = GAME_TYPES[i % GAME_TYPES.length]
      const difficulty = DIFFICULTIES[Math.floor(random() * DIFFICULTIES.length)]
      const players: Player[] = [
        { id: 'player1', name: seedPlayer.name, isAI: false },
        { id: 'ai', name: 'AI', isAI: true },
      ]
      const skills: Skills = { player1: seedPlayer.skill, ai: AI_SKILL[difficulty] }

      const { gameState, history } = gameType === 'rock-paper-scissors'
        ? playRockPaperScissors(players, skills, random)
        : gameType === 'tic-tac-toe'
          ? playBoardGame(new TicTacToeGame(), players, skills, random)
          : playBoardGame(new ConnectFourGame(), players, skills, random)

      const finishedAt = new Date(now.getTime() - random() * SEED_DAYS * DAY_MS)
      gameState.createdAt = new Date(finishedAt.getTime() - (2 + random() * 8) * 60 * 1000)
      gameState.updatedAt = finishedAt

      sessions.push({ gameState, gameType, history, difficulty })
    }
  }

  return sessions
}

function playBoardGame<TState extends BaseGameState, TMove>(
  game: Game<TState, TMove>,
  players: Player[],
  skills: Skills,
  random: () => number
): { gameState: TState; history: GameMove[] } {
  let state = game.getInitialState(players, { firstPlayerId: random() < 0.5 ? 'player1' : 'ai' })
  const history: GameMove[] = []
  let result = game.checkGameEnd(state)

  while (!result) {
    const mover = state.currentPlayerId as SeatId
    const move = chooseBoardMove(game, state, mover, skills[mover], random)
    state = game.applyMove(state, move, mover)
    history.push({ playerId: mover, move, timestamp: new Date() })
    result = game.checkGameEnd(state)
  }

  return { gameState: { ...state, status: 'finished', winner: result.winner }, history }
}

/**
 * A skilled mover wins when it can, otherwise blocks the opponent; everyone else plays randomly
 */
function chooseBoardMove<TState extends BaseGameState, TMove>(
  game: Game<TState, TMove>,
  state: TState,
  mover: SeatId,
  skill: number,
  random: () => number
): TMove {
  if (random() < skill) {
    const opponent: SeatId = mover === 'ai' ? 'player1' : 'ai'
    const smartMove = findWinningMove(game, state, mover)
      ?? findWinningMove(game, { ...state, currentPlayerId: opponent }, opponent)
    if (smartMove !== undefined) {
      return smartMove
    }
  }

  const validMoves = game.getValidMoves(state, mover)
  return validMoves[Math.floor(random() * validMoves.length)]
}

function findWinningMove<TState extends BaseGameState, TMove>(game: Game<TState, TMove>, state: TState, playerId: PlayerId): TMove | undefined {
  return game.getValidMoves(state, playerId)
    .find(move => game.checkGameEnd(game.applyMove(state, move, playerId))?.winner === playerId)
}

/**
 * Best of 3. A skilled side sometimes "reads" the other choice and counters it.
 */
function playRockPaperScissors(
  players: Player[],
  skills: Skills,
  random: () => number
): { gameState: RPSGameState; history: GameMove[] } {
  const game = new RockPaperScissorsGame()
  let state = game.getInitialState(players, { maxRounds: 3 })
  const history: GameMove[] = []
  let result = game.checkGameEnd(state)

  while (!result) {
    let playerChoice = RPS_CHOICES[Math.floor(random() * RPS_CHOICES.length)]
    let aiChoice = RPS_CHOICES[Math.floor(random() * RPS_CHOICES.length)]
    if (random() < skills.ai * 0.4) {
      aiChoice = BEATEN_BY[playerChoice]
    } else if (random() < skills.player1 * 0.4) {
      playerChoice = BEATEN_BY[aiChoice]
    }

    state = game.applyMove(state, { choice: playerChoice }, 'player1')
    state = game.applyMove(state, { choice: aiChoice }, 'ai')
    history.push(
      { playerId: 'player1', move: { choice: playerChoice }, timestamp: new Date() },
      { playerId: 'ai', move: { choice: aiChoice }, timestamp: new Date() }
    )
    result = game.checkGameEnd(state)
  }

  return { gameState: { ...state, status: 'finished', winner: result.winner }, history }
}

function toSqlDate(date: Date): string {
  return new Date(date).toISOString().replace('T', ' ').slice(0, 19)
}

function writeSessions(dbPath: string, sessions: SeedSession[]): void {
  const db = new Database(dbPath)

  for (const table of Object.values(TABLES)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        game_session TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  const insertAll = db.transaction((items: SeedSession[]) => {
    for (const session of items) {
      db.prepare(`INSERT OR REPLACE INTO ${TABLES[session.gameType]} (id, game_session, created_at, updated_at) VALUES (?, ?, ?, ?)`)
        .run(session.gameState.id, JSON.stringify(session), toSqlDate(session.gameState.createdAt), toSqlDate(session.gameState.updatedAt))
    }
  })
  insertAll(sessions)

  db.close()
}

function main(): void {
  const dbPath = process.env.GAMES_DB_PATH || DEFAULT_DB_PATH
  const sessions = simulateSessions({ gamesPerPlayer: 10 })

  writeSessions(dbPath, sessions)
  console.log(`Seeded ${sessions.length} finished games for ${SEED_PLAYERS.map(p => p.name).join(', ')} into ${dbPath}`)
}

// Only run when executed directly (node dist/seed.js), not when imported by tests
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
