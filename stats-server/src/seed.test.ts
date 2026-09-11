import { GAME_TYPES } from '@turn-based-mcp/shared'
import { simulateSessions, createRandom } from './seed.js'

describe('seed simulation', () => {
  const now = new Date('2026-09-10T12:00:00.000Z')

  it('should create finished games of every type with a valid winner and a recent date', () => {
    const sessions = simulateSessions({ gamesPerPlayer: 12, random: createRandom(42), now })

    expect(sessions).toHaveLength(48) // 4 seed players x 12 games
    expect(new Set(sessions.map(session => session.gameType))).toEqual(new Set(GAME_TYPES))

    const fifteenDaysAgo = now.getTime() - 15 * 24 * 60 * 60 * 1000
    for (const session of sessions) {
      expect(session.gameState.status).toBe('finished')
      expect(['player1', 'ai', 'draw']).toContain(session.gameState.winner)
      const finishedAt = new Date(session.gameState.updatedAt).getTime()
      expect(finishedAt).toBeLessThanOrEqual(now.getTime())
      expect(finishedAt).toBeGreaterThan(fifteenDaysAgo)
    }
  })

  it('should produce the same results for the same random seed', () => {
    const winners = (seed: number) =>
      simulateSessions({ gamesPerPlayer: 5, random: createRandom(seed), now })
        .map(session => `${session.gameType}:${session.difficulty}:${session.gameState.winner}`)

    expect(winners(7)).toEqual(winners(7))
  })
})
