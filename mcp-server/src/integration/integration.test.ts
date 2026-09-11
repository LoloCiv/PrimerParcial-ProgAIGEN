import { vi } from 'vitest'
import { handleToolCall } from '../handlers/tool-handlers.js'
import { listResources, readResource } from '../handlers/resource-handlers.js'
import { listPrompts, getPrompt } from '../handlers/prompt-handlers.js'
import * as httpClient from '../utils/http-client.js'

// Import the real constants from shared package
// Importing shared constants (some unused intentionally for integration scope) - remove to satisfy lint
// Removed unused imports

// Mock the web API calls for testing
vi.mock('../utils/http-client.js', () => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
  getGameViaAPI: vi.fn(),
  createGameViaAPI: vi.fn(),
  submitMoveViaAPI: vi.fn(),
  getGamesByType: vi.fn()
}))

// Mock only the game classes from shared library
// In vitest v4, mocks used as constructors must use 'function' syntax
vi.mock('@turn-based-mcp/shared', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    TicTacToeGame: vi.fn(function() {
      return {
        getValidMoves: vi.fn(() => [{ row: 0, col: 0 }])
      }
    }),
    RockPaperScissorsGame: vi.fn(function() { return {} }),
    ConnectFourGame: vi.fn(function() {
      return {
        getValidMoves: vi.fn(() => [{ column: 3 }])
      }
    })
  }
})

// Mock AI modules
// In vitest v4, mocks used as constructors must use 'function' syntax
vi.mock('../ai/tic-tac-toe-ai.js', () => ({
  TicTacToeAI: vi.fn(function() {
    return {
      makeMove: vi.fn(() => ({ row: 0, col: 0 }))
    }
  })
}))

vi.mock('../ai/rock-paper-scissors-ai.js', () => ({
  RockPaperScissorsAI: vi.fn(function() {
    return {
      makeChoice: vi.fn(() => 'rock')
    }
  })
}))

vi.mock('../ai/connect-four-ai.js', () => ({
  ConnectFourAI: vi.fn(function() {
    return {
      makeMove: vi.fn(() => ({ column: 3 }))
    }
  })
}))

describe('MCP Server Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Resource Handlers', () => {
    it('should list resources correctly', async () => {
      const mockGetGamesByType = vi.mocked(httpClient.getGamesByType)
      mockGetGamesByType.mockResolvedValue([
        {
          gameState: {
            id: 'test-game-1',
            status: 'playing',
            currentPlayerId: 'player1'
          }
        }
      ])

      const result = await listResources()
      
      expect(result.resources).toBeDefined()
      expect(result.resources.length).toBeGreaterThan(0)
      
      // Should include game type resources
  const gameTypeResources = (result.resources as Array<{ uri: string }>).filter(r => r.uri.match(/^game:\/\/[^/]+$/))
      expect(gameTypeResources.length).toBe(3) // tic-tac-toe, rock-paper-scissors, connect-four
      
      // Should include individual game resources
  const individualGameResources = (result.resources as Array<{ uri: string }>).filter(r => r.uri.match(/^game:\/\/[^/]+\/[^/]+$/))
      expect(individualGameResources.length).toBeGreaterThan(0)
    })

    it('should read game type resource correctly', async () => {
      const mockGetGamesByType = vi.mocked(httpClient.getGamesByType)
      mockGetGamesByType.mockResolvedValue([
        {
          gameState: {
            id: 'game-1',
            status: 'playing',
            currentPlayerId: 'player1',
            players: { player1: 'Human', ai: 'AI' }
          },
          difficulty: 'medium'
        }
      ])

      const result = await readResource('game://tic-tac-toe')
      
      expect(result.contents).toBeDefined()
      expect(result.contents.length).toBe(1)
      
      const content = JSON.parse(result.contents[0].text)
      expect(content.gameType).toBe('tic-tac-toe')
      expect(content.games).toBeDefined()
      expect(content.totalGames).toBe(1)
    })

    it('should read individual game resource correctly', async () => {
      const mockGetGameViaAPI = vi.mocked(httpClient.getGameViaAPI)
      mockGetGameViaAPI.mockResolvedValue({
        gameState: {
          id: 'test-game-1',
          status: 'playing',
          currentPlayerId: 'player1'
        }
      })

      const result = await readResource('game://tic-tac-toe/test-game-1')
      
      expect(result.contents).toBeDefined()
      expect(result.contents.length).toBe(1)
      
      const content = JSON.parse(result.contents[0].text)
      expect(content.gameType).toBe('tic-tac-toe')
      expect(content.gameId).toBe('test-game-1')
      expect(content.gameSession).toBeDefined()
    })
  })

  describe('Tool Handlers', () => {
    it('should create tic-tac-toe game correctly', async () => {
      const mockCreateGameViaAPI = vi.mocked(httpClient.createGameViaAPI)
      mockCreateGameViaAPI.mockResolvedValue({
        gameState: {
          id: 'new-game-id',
          status: 'playing',
          players: { player1: 'Test Player', ai: 'AI' }
        }
      })

      const result = await handleToolCall('create_game', {
        gameType: 'tic-tac-toe'
      })
      
  const created = result as any
  expect(created.gameId).toBe('new-game-id')
  expect(created.message).toContain('Created new Tic-Tac-Toe game')
    })

    it('should handle play moves correctly', async () => {
      const mockGetGameViaAPI = vi.mocked(httpClient.getGameViaAPI)
      const mockSubmitMoveViaAPI = vi.mocked(httpClient.submitMoveViaAPI)
      
      mockGetGameViaAPI.mockResolvedValue({
        gameState: {
          id: 'test-game',
          status: 'playing',
          currentPlayerId: 'ai'
        },
        difficulty: 'medium'
      })
      
      mockSubmitMoveViaAPI.mockResolvedValue({
        gameState: {
          id: 'test-game',
          status: 'playing',
          currentPlayerId: 'player1'
        }
      })

      const result = await handleToolCall('play_game', {
        gameId: 'test-game',
        gameType: 'tic-tac-toe'
      })
      
  const playResult = result as any
  expect(playResult.gameId).toBe('test-game')
  expect(playResult.aiMove).toBeDefined()
  expect(playResult.message).toContain('AI made move')
    })

    it('should create connect-four game correctly', async () => {
      vi.mocked(httpClient.createGameViaAPI).mockResolvedValue({
        gameState: {
          id: 'c4-game',
          status: 'playing',
          players: { player1: 'Test Player', ai: 'AI' }
        }
      })

      const result = await handleToolCall('create_game', { gameType: 'connect-four' }) as any

      expect(result.gameId).toBe('c4-game')
      expect(result.message).toContain('Created new Connect Four game')
    })

    it('should pass the chosen disc colour when creating a connect-four game', async () => {
      const mockCreateGameViaAPI = vi.mocked(httpClient.createGameViaAPI)
      mockCreateGameViaAPI.mockResolvedValue({
        gameState: { id: 'c4-game', status: 'playing' }
      })
      const server = { elicitInput: vi.fn() }

      const result = await handleToolCall('create_game', {
        gameType: 'connect-four',
        difficulty: 'hard',
        playerName: 'TestPlayer',
        playerColor: 'yellow'
      }, server) as any

      expect(server.elicitInput).not.toHaveBeenCalled()
      expect(mockCreateGameViaAPI).toHaveBeenCalledWith('connect-four', 'TestPlayer', undefined, 'hard', { playerColor: 'yellow' })
      expect(result.message).toContain('AI goes first')
    })

    it('should play a connect-four AI move correctly', async () => {
      vi.mocked(httpClient.getGameViaAPI).mockResolvedValue({
        gameState: { id: 'c4-game', status: 'playing', currentPlayerId: 'ai' },
        difficulty: 'hard'
      })
      const mockSubmitMoveViaAPI = vi.mocked(httpClient.submitMoveViaAPI)
      mockSubmitMoveViaAPI.mockResolvedValue({
        gameState: { id: 'c4-game', status: 'playing', currentPlayerId: 'player1' }
      })

      const result = await handleToolCall('play_game', { gameId: 'c4-game', gameType: 'connect-four' }) as any

      expect(mockSubmitMoveViaAPI).toHaveBeenCalledWith('connect-four', 'c4-game', { column: 3 }, 'ai')
      expect(result.aiMove).toEqual({ column: 3 })
      expect(result.message).toContain('AI dropped a disc in column 4')
    })

    it('should make a connect-four move for the player', async () => {
      vi.mocked(httpClient.getGameViaAPI).mockResolvedValue({
        gameState: { id: 'c4-game', status: 'playing', currentPlayerId: 'player1' }
      })
      const mockSubmitMoveViaAPI = vi.mocked(httpClient.submitMoveViaAPI)
      mockSubmitMoveViaAPI.mockResolvedValue({
        gameState: { id: 'c4-game', status: 'playing', currentPlayerId: 'ai' }
      })

      const result = await handleToolCall('make_player_move', {
        gameId: 'c4-game',
        gameType: 'connect-four',
        move: { column: 0 }
      }) as any

      expect(mockSubmitMoveViaAPI).toHaveBeenCalledWith('connect-four', 'c4-game', { column: 0 }, 'player1')
      expect(result.message).toContain('Player dropped a disc in column 1')
    })

    it('should analyze a connect-four game', async () => {
      vi.mocked(httpClient.getGameViaAPI).mockResolvedValue({
        gameState: {
          id: 'c4-game',
          status: 'playing',
          currentPlayerId: 'ai',
          board: Array.from({ length: 6 }, () => Array(7).fill(null)),
          playerDiscs: { player1: 'R', ai: 'Y' }
        },
        history: []
      })

      const result = await handleToolCall('analyze_game', { gameId: 'c4-game', gameType: 'connect-four' }) as any

      expect(result.validMoves).toEqual([{ column: 3 }])
      expect(result.analysis).toContain('Current Board')
    })

    it('should report a finished connect-four game when waiting for the player', async () => {
      vi.mocked(httpClient.getGameViaAPI).mockResolvedValue({
        gameState: { id: 'c4-game', status: 'finished', winner: 'player1', currentPlayerId: 'ai' }
      })

      const result = await handleToolCall('wait_for_player_move', { gameId: 'c4-game', gameType: 'connect-four' }) as any

      expect(result.status).toBe('game_finished')
    })

    it('should handle invalid tool names', async () => {
      await expect(handleToolCall('invalid_tool', {}))
        .rejects.toThrow('Unknown tool: invalid_tool')
    })
  })

  describe('Prompt Handlers', () => {
    it('should list all prompts correctly', async () => {
      const result = await listPrompts()
      
      expect(result.prompts).toBeDefined()
      expect(Array.isArray(result.prompts)).toBe(true)
      expect(result.prompts.length).toBeGreaterThan(0)
      
      // Check for essential prompt categories
      const promptNames = result.prompts.map(p => p.name)
      expect(promptNames).toContain('tic_tac_toe_rules')
      expect(promptNames).toContain('getting_started')
      expect(promptNames).toContain('troubleshooting')
    })

    it('should get specific prompts correctly', async () => {
      const result = await getPrompt('tic_tac_toe_rules')
      
      expect(result.description).toBeDefined()
      expect(result.messages).toBeDefined()
      expect(Array.isArray(result.messages)).toBe(true)
      expect(result.messages.length).toBe(1)
      
      const message = result.messages[0]
      expect(message.role).toBe('user')
      expect(message.content.type).toBe('text')
      expect(message.content.text).toContain('Please explain how to play Tic-Tac-Toe')
    })

    it('should handle parameterized prompts', async () => {
      const result = await getPrompt('difficulty_strategy_guide', {
        gameType: 'tic-tac-toe',
        difficulty: 'hard'
      })
      
      expect(result.messages[0].content.text).toContain('Perfect play is required')
    })

    it('should include the connect four rules prompt', async () => {
      const { prompts } = await listPrompts()
      expect(prompts.map(p => p.name)).toContain('connect_four_rules')

      const result = await getPrompt('connect_four_rules')
      expect(result.messages[0].content.text).toContain('Please explain how to play Connect Four')
    })

    it('should give connect four strategy for hard difficulty', async () => {
      const result = await getPrompt('difficulty_strategy_guide', {
        gameType: 'connect-four',
        difficulty: 'hard'
      })

      expect(result.messages[0].content.text).toContain('center column')
    })

    it('should handle invalid prompt names', async () => {
      await expect(getPrompt('invalid_prompt'))
        .rejects.toThrow('Prompt not found: invalid_prompt')
    })
  })
})
