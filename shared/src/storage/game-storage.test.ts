import { vi } from 'vitest'
import * as gameStorage from './game-storage';
import * as sqliteStorage from './sqlite-storage';
import type { GameSession } from '../types/game';
import type { TicTacToeGameState, RPSGameState, ConnectFourGameState } from '../types/games';

// Mock sqlite-storage module
vi.mock('./sqlite-storage');
const mockSqliteStorage = sqliteStorage as any;

describe('Game Storage', () => {
  const mockTicTacToeGameSession: GameSession<TicTacToeGameState> = {
    gameState: {
      id: 'test-game-1',
      players: [
        { id: 'player1', name: 'Player 1', isAI: false },
        { id: 'player2', name: 'Player 2', isAI: true }
      ],
      currentPlayerId: 'player1',
      status: 'playing',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null]
      ],
      playerSymbols: {
        player1: 'X',
        player2: 'O'
      }
    },
    gameType: 'tic-tac-toe',
    history: []
  };

  const mockRPSGameSession: GameSession<RPSGameState> = {
    gameState: {
      id: 'test-rps-1',
      players: [
        { id: 'player1', name: 'Player 1', isAI: false },
        { id: 'player2', name: 'AI', isAI: true }
      ],
      currentPlayerId: 'player1',
      status: 'playing',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      rounds: [],
      currentRound: 0,
      scores: {
        player1: 0,
        player2: 0
      },
      maxRounds: 3
    },
    gameType: 'rock-paper-scissors',
    history: []
  };

  const mockConnectFourGameSession: GameSession<ConnectFourGameState> = {
    gameState: {
      id: 'test-c4-1',
      players: [
        { id: 'player1', name: 'Player 1', isAI: false },
        { id: 'ai', name: 'AI', isAI: true }
      ],
      currentPlayerId: 'player1',
      status: 'playing',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      board: Array.from({ length: 6 }, () => Array(7).fill(null)),
      playerDiscs: {
        player1: 'R',
        ai: 'Y'
      }
    },
    gameType: 'connect-four',
    history: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TicTacToe Game Functions', () => {
    describe('getTicTacToeGame', () => {
      it('should return game when it exists', async () => {
        mockSqliteStorage.getTicTacToeGame.mockResolvedValue(mockTicTacToeGameSession);

        const result = await gameStorage.getTicTacToeGame('test-game-1');

        expect(mockSqliteStorage.getTicTacToeGame).toHaveBeenCalledWith('test-game-1');
        expect(result).toEqual(mockTicTacToeGameSession);
      });

      it('should return undefined when game does not exist', async () => {
        mockSqliteStorage.getTicTacToeGame.mockResolvedValue(undefined);

        const result = await gameStorage.getTicTacToeGame('non-existent');

        expect(mockSqliteStorage.getTicTacToeGame).toHaveBeenCalledWith('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('setTicTacToeGame', () => {
      it('should call sqlite storage to save game', async () => {
        mockSqliteStorage.setTicTacToeGame.mockResolvedValue();

        await gameStorage.setTicTacToeGame('test-game-1', mockTicTacToeGameSession);

        expect(mockSqliteStorage.setTicTacToeGame).toHaveBeenCalledWith('test-game-1', mockTicTacToeGameSession);
      });
    });

    describe('getAllTicTacToeGames', () => {
      it('should return all games from sqlite storage', async () => {
        const mockGames = [mockTicTacToeGameSession];
        mockSqliteStorage.getAllTicTacToeGames.mockResolvedValue(mockGames);

        const result = await gameStorage.getAllTicTacToeGames();

        expect(mockSqliteStorage.getAllTicTacToeGames).toHaveBeenCalled();
        expect(result).toEqual(mockGames);
      });

      it('should return empty array when no games exist', async () => {
        mockSqliteStorage.getAllTicTacToeGames.mockResolvedValue([]);

        const result = await gameStorage.getAllTicTacToeGames();

        expect(result).toEqual([]);
      });
    });

    describe('deleteTicTacToeGame', () => {
      it('should return true when game is deleted successfully', async () => {
        mockSqliteStorage.deleteTicTacToeGame.mockResolvedValue(true);

        const result = await gameStorage.deleteTicTacToeGame('test-game-1');

        expect(mockSqliteStorage.deleteTicTacToeGame).toHaveBeenCalledWith('test-game-1');
        expect(result).toBe(true);
      });

      it('should return false when game does not exist', async () => {
        mockSqliteStorage.deleteTicTacToeGame.mockResolvedValue(false);

        const result = await gameStorage.deleteTicTacToeGame('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Rock Paper Scissors Game Functions', () => {
    describe('getRPSGame', () => {
      it('should return game when it exists', async () => {
        mockSqliteStorage.getRPSGame.mockResolvedValue(mockRPSGameSession);

        const result = await gameStorage.getRPSGame('test-rps-1');

        expect(mockSqliteStorage.getRPSGame).toHaveBeenCalledWith('test-rps-1');
        expect(result).toEqual(mockRPSGameSession);
      });

      it('should return undefined when game does not exist', async () => {
        mockSqliteStorage.getRPSGame.mockResolvedValue(undefined);

        const result = await gameStorage.getRPSGame('non-existent');

        expect(result).toBeUndefined();
      });
    });

    describe('setRPSGame', () => {
      it('should call sqlite storage to save game', async () => {
        mockSqliteStorage.setRPSGame.mockResolvedValue();

        await gameStorage.setRPSGame('test-rps-1', mockRPSGameSession);

        expect(mockSqliteStorage.setRPSGame).toHaveBeenCalledWith('test-rps-1', mockRPSGameSession);
      });
    });

    describe('getAllRPSGames', () => {
      it('should return all games from sqlite storage', async () => {
        const mockGames = [mockRPSGameSession];
        mockSqliteStorage.getAllRPSGames.mockResolvedValue(mockGames);

        const result = await gameStorage.getAllRPSGames();

        expect(mockSqliteStorage.getAllRPSGames).toHaveBeenCalled();
        expect(result).toEqual(mockGames);
      });

      it('should return empty array when no games exist', async () => {
        mockSqliteStorage.getAllRPSGames.mockResolvedValue([]);

        const result = await gameStorage.getAllRPSGames();

        expect(result).toEqual([]);
      });
    });

    describe('deleteRPSGame', () => {
      it('should return true when game is deleted successfully', async () => {
        mockSqliteStorage.deleteRPSGame.mockResolvedValue(true);

        const result = await gameStorage.deleteRPSGame('test-rps-1');

        expect(mockSqliteStorage.deleteRPSGame).toHaveBeenCalledWith('test-rps-1');
        expect(result).toBe(true);
      });

      it('should return false when game does not exist', async () => {
        mockSqliteStorage.deleteRPSGame.mockResolvedValue(false);

        const result = await gameStorage.deleteRPSGame('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Connect Four Game Functions', () => {
    it('getConnectFourGame should delegate to sqlite storage', async () => {
      mockSqliteStorage.getConnectFourGame.mockResolvedValue(mockConnectFourGameSession);

      const result = await gameStorage.getConnectFourGame('test-c4-1');

      expect(mockSqliteStorage.getConnectFourGame).toHaveBeenCalledWith('test-c4-1');
      expect(result).toEqual(mockConnectFourGameSession);
    });

    it('setConnectFourGame should delegate to sqlite storage', async () => {
      mockSqliteStorage.setConnectFourGame.mockResolvedValue();

      await gameStorage.setConnectFourGame('test-c4-1', mockConnectFourGameSession);

      expect(mockSqliteStorage.setConnectFourGame).toHaveBeenCalledWith('test-c4-1', mockConnectFourGameSession);
    });

    it('getAllConnectFourGames should delegate to sqlite storage', async () => {
      mockSqliteStorage.getAllConnectFourGames.mockResolvedValue([mockConnectFourGameSession]);

      const result = await gameStorage.getAllConnectFourGames();

      expect(mockSqliteStorage.getAllConnectFourGames).toHaveBeenCalled();
      expect(result).toEqual([mockConnectFourGameSession]);
    });

    it('deleteConnectFourGame should delegate to sqlite storage', async () => {
      mockSqliteStorage.deleteConnectFourGame.mockResolvedValue(true);

      const result = await gameStorage.deleteConnectFourGame('test-c4-1');

      expect(mockSqliteStorage.deleteConnectFourGame).toHaveBeenCalledWith('test-c4-1');
      expect(result).toBe(true);
    });
  });
});
