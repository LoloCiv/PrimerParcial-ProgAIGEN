import { vi } from 'vitest'
import { NextRequest } from 'next/server';
import type { GameSession, ConnectFourGameState } from '@turn-based-mcp/shared';

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
  ConnectFourGame: vi.fn(function() { return mockGame; }),
  getConnectFourGame: vi.fn(),
  setConnectFourGame: vi.fn()
}));

import { POST } from './route';
import { getConnectFourGame, setConnectFourGame } from '@turn-based-mcp/shared';

const mockGetConnectFourGame = vi.mocked(getConnectFourGame);
const mockSetConnectFourGame = vi.mocked(setConnectFourGame);

const createConnectFourState = (overrides: Partial<ConnectFourGameState> = {}): ConnectFourGameState => ({
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
  playerDiscs: { player1: 'R', ai: 'Y' },
  ...overrides
});

const postMove = (body: unknown) => POST(
  new NextRequest('http://localhost:3000/api/games/connect-four/test-c4/move', {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  { params: Promise.resolve({ id: 'test-c4' }) }
);

describe('/api/games/connect-four/[id]/move', () => {
  let gameSession: GameSession<ConnectFourGameState>;

  beforeEach(() => {
    vi.clearAllMocks();
    gameSession = { gameState: createConnectFourState(), gameType: 'connect-four', history: [] };
  });

  it('should apply a valid move, record it and store the session', async () => {
    const updatedState = createConnectFourState({ currentPlayerId: 'ai', lastMove: { row: 5, column: 3 } });
    mockGetConnectFourGame.mockResolvedValue(gameSession);
    mockGame.validateMove.mockReturnValue(true);
    mockGame.applyMove.mockReturnValue(updatedState);
    mockGame.checkGameEnd.mockReturnValue(null);
    mockSetConnectFourGame.mockResolvedValue();

    const response = await postMove({ move: { column: 3 }, playerId: 'player1' });
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(mockGame.applyMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-c4' }), { column: 3 }, 'player1');
    expect(mockSetConnectFourGame).toHaveBeenCalledWith('test-c4', expect.objectContaining({
      gameState: updatedState,
      history: [expect.objectContaining({ playerId: 'player1', move: { column: 3 } })]
    }));
    expect(responseData.gameState.currentPlayerId).toBe('ai');
  });

  it('should finish the game when the move wins', async () => {
    mockGetConnectFourGame.mockResolvedValue(gameSession);
    mockGame.validateMove.mockReturnValue(true);
    mockGame.applyMove.mockReturnValue(createConnectFourState({ currentPlayerId: 'ai' }));
    mockGame.checkGameEnd.mockReturnValue({ winner: 'player1', reason: 'Four in a row (horizontal)' });
    mockSetConnectFourGame.mockResolvedValue();

    const response = await postMove({ move: { column: 3 }, playerId: 'player1' });
    const responseData = await response.json();

    expect(responseData.gameState.status).toBe('finished');
    expect(responseData.gameState.winner).toBe('player1');
  });

  it('should return 404 when the game does not exist', async () => {
    mockGetConnectFourGame.mockResolvedValue(undefined);

    const response = await postMove({ move: { column: 3 }, playerId: 'player1' });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Game not found' });
  });

  it('should return 400 for an invalid move', async () => {
    mockGetConnectFourGame.mockResolvedValue(gameSession);
    mockGame.validateMove.mockReturnValue(false);

    const response = await postMove({ move: { column: 9 }, playerId: 'player1' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid move' });
    expect(mockGame.applyMove).not.toHaveBeenCalled();
  });

  it('should return 500 when storing the move fails', async () => {
    mockGetConnectFourGame.mockResolvedValue(gameSession);
    mockGame.validateMove.mockReturnValue(true);
    mockGame.applyMove.mockReturnValue(createConnectFourState());
    mockGame.checkGameEnd.mockReturnValue(null);
    mockSetConnectFourGame.mockRejectedValue(new Error('Storage failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await postMove({ move: { column: 3 }, playerId: 'player1' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to process move' });
  });
});
