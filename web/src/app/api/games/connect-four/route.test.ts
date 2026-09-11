import { vi } from 'vitest'
import { NextRequest } from 'next/server';
import type { ConnectFourGameState } from '@turn-based-mcp/shared';

const mockGame = vi.hoisted(() => ({
  getInitialState: vi.fn(),
  validateMove: vi.fn(),
  applyMove: vi.fn(),
  checkGameEnd: vi.fn(),
  getValidMoves: vi.fn()
}));

// Mock dependencies BEFORE importing the route
// In vitest v4, mocks used as constructors must use 'function' syntax
vi.mock('@turn-based-mcp/shared', async () => ({
  ...await vi.importActual('@turn-based-mcp/shared/constants'),
  ConnectFourGame: vi.fn(function() { return mockGame; })
}));

vi.mock('../../../../lib/game-storage', () => ({
  setConnectFourGame: vi.fn(),
  getAllConnectFourGames: vi.fn(),
  deleteConnectFourGame: vi.fn()
}));

import * as gameStorage from '../../../../lib/game-storage';
import { GET, POST, DELETE } from './route';

const mockGameStorage = vi.mocked(gameStorage);

const createConnectFourState = (): ConnectFourGameState => ({
  id: 'test-c4',
  players: [
    { id: 'player1', name: 'Player', isAI: false },
    { id: 'ai', name: 'AI', isAI: true }
  ],
  currentPlayerId: 'player1',
  status: 'playing',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  board: Array.from({ length: 6 }, () => Array(7).fill(null)),
  playerDiscs: { player1: 'R', ai: 'Y' }
});

describe('/api/games/connect-four', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGame.getInitialState.mockImplementation(() => createConnectFourState());
  });

  describe('POST', () => {
    it('should create a game where the player is red and moves first by default', async () => {
      mockGameStorage.setConnectFourGame.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/games/connect-four', {
        method: 'POST',
        body: JSON.stringify({ playerName: 'TestPlayer', difficulty: 'hard' })
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(mockGame.getInitialState).toHaveBeenCalledWith([
        { id: 'player1', name: 'TestPlayer', isAI: false },
        { id: 'ai', name: 'AI', isAI: true }
      ], { firstPlayerId: 'player1' });
      expect(mockGameStorage.setConnectFourGame).toHaveBeenCalledWith(
        'test-c4',
        expect.objectContaining({ gameType: 'connect-four', difficulty: 'hard', history: [] })
      );
      expect(responseData.gameType).toBe('connect-four');
    });

    it('should let the AI start when the player picks yellow', async () => {
      mockGameStorage.setConnectFourGame.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/games/connect-four', {
        method: 'POST',
        body: JSON.stringify({ playerColor: 'yellow' })
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(mockGame.getInitialState).toHaveBeenCalledWith([
        { id: 'player1', name: 'Player', isAI: false },
        { id: 'ai', name: 'AI', isAI: true }
      ], { firstPlayerId: 'ai' });
      expect(responseData.difficulty).toBe('medium');
    });

    it('should use a custom game id when provided', async () => {
      mockGameStorage.setConnectFourGame.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/games/connect-four', {
        method: 'POST',
        body: JSON.stringify({ gameId: 'my-c4-game' })
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(mockGameStorage.setConnectFourGame).toHaveBeenCalledWith('my-c4-game', expect.anything());
      expect(responseData.gameState.id).toBe('my-c4-game');
    });

    it('should return 500 when the game cannot be stored', async () => {
      mockGameStorage.setConnectFourGame.mockRejectedValue(new Error('Storage failed'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const request = new NextRequest('http://localhost:3000/api/games/connect-four', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to create game' });
    });
  });

  describe('GET', () => {
    it('should return all connect four games', async () => {
      const games = [{ gameState: createConnectFourState(), gameType: 'connect-four' as const, history: [] }];
      mockGameStorage.getAllConnectFourGames.mockResolvedValue(games);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toHaveLength(1);
      expect(responseData[0].gameState.id).toBe('test-c4');
    });
  });

  describe('DELETE', () => {
    it('should require a game id', async () => {
      const request = new NextRequest('http://localhost:3000/api/games/connect-four', { method: 'DELETE' });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Game ID is required' });
    });

    it('should return 404 when the game does not exist', async () => {
      mockGameStorage.deleteConnectFourGame.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/games/connect-four?gameId=missing', { method: 'DELETE' });

      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });

    it('should delete an existing game', async () => {
      mockGameStorage.deleteConnectFourGame.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/games/connect-four?gameId=test-c4', { method: 'DELETE' });

      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockGameStorage.deleteConnectFourGame).toHaveBeenCalledWith('test-c4');
      expect(await response.json()).toEqual({ success: true });
    });
  });
});
