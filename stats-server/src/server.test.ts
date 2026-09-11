/**
 * Black-box tests for the game-stats MCP server
 *
 * They talk to the server through the MCP protocol (in-memory transport) using a
 * temporary SQLite file, so the implementation can be refactored freely as long
 * as the tools keep answering the same way.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createStatsServer } from './server.js'

type Winner = 'player1' | 'ai' | 'draw'

interface FixtureGame {
  id: string
  gameType: 'tic-tac-toe' | 'rock-paper-scissors' | 'connect-four'
  player: string
  difficulty: 'easy' | 'medium' | 'hard'
  winner?: Winner
  status?: 'playing' | 'finished'
  date: string
  scores?: [number, number]
}

const TABLES = {
  'tic-tac-toe': 'tic_tac_toe_games',
  'rock-paper-scissors': 'rps_games',
  'connect-four': 'connect_four_games'
} as const

// Ana: 3 wins, 1 loss, 1 draw (last two are wins) + 1 game in progress
// Bruno: 1 win, 3 losses (last two are losses)
const FIXTURE_GAMES: FixtureGame[] = [
  { id: 't1', gameType: 'tic-tac-toe', player: 'Ana', difficulty: 'easy', winner: 'player1', date: '2026-09-01T10:00:00.000Z' },
  { id: 't2', gameType: 'tic-tac-toe', player: 'Ana', difficulty: 'hard', winner: 'draw', date: '2026-09-02T10:00:00.000Z' },
  { id: 'r1', gameType: 'rock-paper-scissors', player: 'Ana', difficulty: 'medium', winner: 'ai', scores: [1, 2], date: '2026-09-03T10:00:00.000Z' },
  { id: 'c1', gameType: 'connect-four', player: 'Ana', difficulty: 'medium', winner: 'player1', date: '2026-09-04T10:00:00.000Z' },
  { id: 'c2', gameType: 'connect-four', player: 'ana ', difficulty: 'hard', winner: 'player1', date: '2026-09-05T10:00:00.000Z' },
  { id: 't3', gameType: 'tic-tac-toe', player: 'Bruno', difficulty: 'hard', winner: 'ai', date: '2026-09-01T12:00:00.000Z' },
  { id: 'r2', gameType: 'rock-paper-scissors', player: 'Bruno', difficulty: 'easy', winner: 'player1', scores: [2, 1], date: '2026-09-02T12:00:00.000Z' },
  { id: 'c3', gameType: 'connect-four', player: 'Bruno', difficulty: 'hard', winner: 'ai', date: '2026-09-03T12:00:00.000Z' },
  { id: 't4', gameType: 'tic-tac-toe', player: 'Bruno', difficulty: 'medium', winner: 'ai', date: '2026-09-06T12:00:00.000Z' },
  { id: 'p1', gameType: 'connect-four', player: 'Ana', difficulty: 'medium', status: 'playing', date: '2026-09-07T10:00:00.000Z' }
]

function toSession(game: FixtureGame) {
  const gameState: Record<string, unknown> = {
    id: game.id,
    players: [
      { id: 'player1', name: game.player, isAI: false },
      { id: 'ai', name: 'AI', isAI: true }
    ],
    currentPlayerId: 'player1',
    status: game.status ?? 'finished',
    winner: game.winner,
    createdAt: game.date,
    updatedAt: game.date
  }
  if (game.scores) {
    gameState.scores = { player1: game.scores[0], ai: game.scores[1] }
  }
  return { gameState, gameType: game.gameType, history: [], difficulty: game.difficulty }
}

function createDatabase(file: string, games: FixtureGame[], tables: string[] = Object.values(TABLES)) {
  const db = new Database(file)
  for (const table of tables) {
    db.exec(`CREATE TABLE ${table} (
      id TEXT PRIMARY KEY,
      game_session TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)
  }
  for (const game of games) {
    db.prepare(`INSERT INTO ${TABLES[game.gameType]} (id, game_session) VALUES (?, ?)`)
      .run(game.id, JSON.stringify(toSession(game)))
  }
  db.close()
}

async function connect(dbPath: string): Promise<Client> {
  const server = createStatsServer(dbPath)
  const client = new Client({ name: 'stats-test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return client
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as Array<{ type: string; text: string }>)[0].text
  const isError = result.isError === true
  return { isError, text, data: isError ? undefined : JSON.parse(text) }
}

describe('game-stats MCP server', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'game-stats-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('with games in the database', () => {
    let client: Client

    beforeAll(async () => {
      const dbPath = path.join(tempDir, 'games.db')
      createDatabase(dbPath, FIXTURE_GAMES)
      client = await connect(dbPath)
    })

    afterAll(async () => {
      await client.close()
    })

    it('should expose the four stats tools', async () => {
      const { tools } = await client.listTools()

      expect(tools.map(tool => tool.name).sort()).toEqual([
        'get_ai_performance',
        'get_leaderboard',
        'get_player_stats',
        'get_recent_games'
      ])
    })

    it('should report unknown tools as errors', async () => {
      const result = await callTool(client, 'get_everything')

      expect(result.isError).toBe(true)
      expect(result.text).toContain('Unknown tool')
    })

    describe('get_leaderboard', () => {
      it('should rank players by wins grouping names ignoring case and spaces', async () => {
        const { data } = await callTool(client, 'get_leaderboard')

        expect(data.totalFinishedGames).toBe(9)
        expect(data.leaderboard).toEqual([
          { rank: 1, player: 'Ana', played: 5, wins: 3, losses: 1, draws: 1, winRate: 60 },
          { rank: 2, player: 'Bruno', played: 4, wins: 1, losses: 3, draws: 0, winRate: 25 }
        ])
      })

      it('should filter by game type', async () => {
        const { data } = await callTool(client, 'get_leaderboard', { gameType: 'rock-paper-scissors' })

        expect(data.leaderboard.map((row: { player: string }) => row.player)).toEqual(['Bruno', 'Ana'])
      })

      it('should filter by difficulty', async () => {
        const { data } = await callTool(client, 'get_leaderboard', { difficulty: 'hard' })

        expect(data.leaderboard).toEqual([
          { rank: 1, player: 'Ana', played: 2, wins: 1, losses: 0, draws: 1, winRate: 50 },
          { rank: 2, player: 'Bruno', played: 2, wins: 0, losses: 2, draws: 0, winRate: 0 }
        ])
      })

      it('should respect the limit', async () => {
        const { data } = await callTool(client, 'get_leaderboard', { limit: 1 })

        expect(data.leaderboard).toHaveLength(1)
        expect(data.leaderboard[0].player).toBe('Ana')
      })

      it('should reject an invalid game type', async () => {
        const result = await callTool(client, 'get_leaderboard', { gameType: 'chess' })

        expect(result.isError).toBe(true)
        expect(result.text).toContain('Invalid gameType: chess')
      })

      it('should reject an invalid difficulty', async () => {
        const result = await callTool(client, 'get_leaderboard', { difficulty: 'extreme' })

        expect(result.isError).toBe(true)
        expect(result.text).toContain('Invalid difficulty: extreme')
      })
    })

    describe('get_player_stats', () => {
      it('should summarize totals, games, difficulties, streak and last results', async () => {
        const { data } = await callTool(client, 'get_player_stats', { playerName: 'Ana' })

        expect(data).toEqual({
          player: 'Ana',
          totals: { played: 5, wins: 3, losses: 1, draws: 1, winRate: 60 },
          byGame: {
            'tic-tac-toe': { played: 2, wins: 1, losses: 0, draws: 1, winRate: 50 },
            'rock-paper-scissors': { played: 1, wins: 0, losses: 1, draws: 0, winRate: 0 },
            'connect-four': { played: 2, wins: 2, losses: 0, draws: 0, winRate: 100 }
          },
          byDifficulty: {
            easy: { played: 1, wins: 1, losses: 0, draws: 0, winRate: 100 },
            medium: { played: 2, wins: 1, losses: 1, draws: 0, winRate: 50 },
            hard: { played: 2, wins: 1, losses: 0, draws: 1, winRate: 50 }
          },
          currentStreak: { result: 'win', count: 2 },
          lastResults: [
            { gameId: 'c2', gameType: 'connect-four', difficulty: 'hard', result: 'win', finishedAt: '2026-09-05T10:00:00.000Z' },
            { gameId: 'c1', gameType: 'connect-four', difficulty: 'medium', result: 'win', finishedAt: '2026-09-04T10:00:00.000Z' },
            { gameId: 'r1', gameType: 'rock-paper-scissors', difficulty: 'medium', result: 'loss', finishedAt: '2026-09-03T10:00:00.000Z' },
            { gameId: 't2', gameType: 'tic-tac-toe', difficulty: 'hard', result: 'draw', finishedAt: '2026-09-02T10:00:00.000Z' },
            { gameId: 't1', gameType: 'tic-tac-toe', difficulty: 'easy', result: 'win', finishedAt: '2026-09-01T10:00:00.000Z' }
          ],
          inProgress: 1
        })
      })

      it('should find a player ignoring case and spaces', async () => {
        const { data } = await callTool(client, 'get_player_stats', { playerName: '  bruno ' })

        expect(data.player).toBe('Bruno')
        expect(data.totals).toEqual({ played: 4, wins: 1, losses: 3, draws: 0, winRate: 25 })
        expect(data.currentStreak).toEqual({ result: 'loss', count: 2 })
        expect(data.inProgress).toBe(0)
      })

      it('should explain when the player has no finished games', async () => {
        const result = await callTool(client, 'get_player_stats', { playerName: 'Nadie' })

        expect(result.isError).toBe(true)
        expect(result.text).toContain('No finished games found for player "Nadie"')
      })

      it('should require a player name', async () => {
        const result = await callTool(client, 'get_player_stats', {})

        expect(result.isError).toBe(true)
        expect(result.text).toContain('playerName is required')
      })
    })

    describe('get_ai_performance', () => {
      it('should show how the AI does on each difficulty', async () => {
        const { data } = await callTool(client, 'get_ai_performance')

        expect(data.byDifficulty).toEqual([
          { difficulty: 'easy', played: 2, aiWins: 0, aiLosses: 2, draws: 0, aiWinRate: 0 },
          { difficulty: 'medium', played: 3, aiWins: 2, aiLosses: 1, draws: 0, aiWinRate: 66.7 },
          { difficulty: 'hard', played: 4, aiWins: 2, aiLosses: 1, draws: 1, aiWinRate: 50 }
        ])
      })

      it('should filter by game type', async () => {
        const { data } = await callTool(client, 'get_ai_performance', { gameType: 'tic-tac-toe' })

        expect(data.byDifficulty).toEqual([
          { difficulty: 'easy', played: 1, aiWins: 0, aiLosses: 1, draws: 0, aiWinRate: 0 },
          { difficulty: 'medium', played: 1, aiWins: 1, aiLosses: 0, draws: 0, aiWinRate: 100 },
          { difficulty: 'hard', played: 2, aiWins: 1, aiLosses: 0, draws: 1, aiWinRate: 50 }
        ])
      })
    })

    describe('get_recent_games', () => {
      it('should list finished games newest first', async () => {
        const { data } = await callTool(client, 'get_recent_games', { limit: 3 })

        expect(data.games.map((game: { gameId: string }) => game.gameId)).toEqual(['t4', 'c2', 'c1'])
        expect(data.games[0]).toEqual({
          gameId: 't4',
          gameType: 'tic-tac-toe',
          player: 'Bruno',
          difficulty: 'medium',
          result: 'loss',
          score: null,
          finishedAt: '2026-09-06T12:00:00.000Z'
        })
      })

      it('should leave out games still in progress', async () => {
        const { data } = await callTool(client, 'get_recent_games')

        expect(data.games).toHaveLength(9)
        expect(data.games.map((game: { gameId: string }) => game.gameId)).not.toContain('p1')
      })

      it('should include the rock paper scissors score', async () => {
        const { data } = await callTool(client, 'get_recent_games', { gameType: 'rock-paper-scissors' })

        expect(data.games.map((game: { gameId: string; score: string; result: string }) => [game.gameId, game.score, game.result]))
          .toEqual([['r1', '1-2', 'loss'], ['r2', '2-1', 'win']])
      })

      it('should filter by player ignoring case', async () => {
        const { data } = await callTool(client, 'get_recent_games', { playerName: 'ANA' })

        expect(data.games.map((game: { gameId: string }) => game.gameId)).toEqual(['c2', 'c1', 'r1', 't2', 't1'])
      })
    })
  })

  describe('with an empty database', () => {
    let client: Client

    beforeAll(async () => {
      const dbPath = path.join(tempDir, 'empty.db')
      createDatabase(dbPath, [])
      client = await connect(dbPath)
    })

    afterAll(async () => {
      await client.close()
    })

    it('should return an empty leaderboard with a helpful message', async () => {
      const { data } = await callTool(client, 'get_leaderboard')

      expect(data.leaderboard).toEqual([])
      expect(data.totalFinishedGames).toBe(0)
      expect(data.message).toContain('No finished games yet')
    })
  })

  describe('with a database created before connect four existed', () => {
    let client: Client

    beforeAll(async () => {
      const dbPath = path.join(tempDir, 'old.db')
      createDatabase(dbPath, [FIXTURE_GAMES[0]], [TABLES['tic-tac-toe'], TABLES['rock-paper-scissors']])
      client = await connect(dbPath)
    })

    afterAll(async () => {
      await client.close()
    })

    it('should ignore the missing table', async () => {
      const { data } = await callTool(client, 'get_leaderboard')

      expect(data.leaderboard).toEqual([
        { rank: 1, player: 'Ana', played: 1, wins: 1, losses: 0, draws: 0, winRate: 100 }
      ])
    })
  })

  it('should explain when the database file does not exist', async () => {
    const client = await connect(path.join(tempDir, 'missing.db'))

    const result = await callTool(client, 'get_leaderboard')

    expect(result.isError).toBe(true)
    expect(result.text).toContain('Games database not found')
    await client.close()
  })
})
