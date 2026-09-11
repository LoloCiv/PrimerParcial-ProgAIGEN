import { ConnectFourGame } from './connect-four';
import type { ConnectFourBoard, ConnectFourGameState } from '../types/games';
import type { Player } from '../types/game';

/**
 * Builds a board from 6 strings of 7 chars ('R', 'Y' or '.'), top row first
 */
function boardFrom(rows: string[]): ConnectFourBoard {
  return rows.map(row => row.split('').map(cell => (cell === '.' ? null : (cell as 'R' | 'Y'))));
}

const EMPTY_ROW = '.......';

describe('ConnectFourGame', () => {
  let game: ConnectFourGame;
  let players: Player[];
  let initialState: ConnectFourGameState;

  beforeEach(() => {
    game = new ConnectFourGame();
    players = [
      { id: 'player1', name: 'Player', isAI: false },
      { id: 'ai', name: 'AI', isAI: true }
    ];
    initialState = game.getInitialState(players);
  });

  describe('getInitialState', () => {
    it('should create an empty 6x7 board with player1 as red going first', () => {
      expect(initialState.id).toBeDefined();
      expect(initialState.players).toEqual(players);
      expect(initialState.status).toBe('playing');
      expect(initialState.currentPlayerId).toBe('player1');
      expect(initialState.board).toHaveLength(ConnectFourGame.ROWS);
      initialState.board.forEach(row => {
        expect(row).toHaveLength(ConnectFourGame.COLUMNS);
        expect(row.every(cell => cell === null)).toBe(true);
      });
      expect(initialState.playerDiscs).toEqual({ player1: 'R', ai: 'Y' });
      expect(initialState.createdAt).toBeInstanceOf(Date);
      expect(initialState.updatedAt).toBeInstanceOf(Date);
    });

    it('should give red and the first turn to firstPlayerId', () => {
      const state = game.getInitialState(players, { firstPlayerId: 'ai' });

      expect(state.currentPlayerId).toBe('ai');
      expect(state.playerDiscs).toEqual({ ai: 'R', player1: 'Y' });
    });
  });

  describe('validateMove', () => {
    it('should accept a column with space on the current player turn', () => {
      expect(game.validateMove(initialState, { column: 3 }, 'player1')).toBe(true);
    });

    it('should reject a move when it is not the player turn', () => {
      expect(game.validateMove(initialState, { column: 3 }, 'ai')).toBe(false);
    });

    it('should reject columns out of range or not integers', () => {
      expect(game.validateMove(initialState, { column: -1 }, 'player1')).toBe(false);
      expect(game.validateMove(initialState, { column: 7 }, 'player1')).toBe(false);
      expect(game.validateMove(initialState, { column: 2.5 }, 'player1')).toBe(false);
      expect(game.validateMove(initialState, { column: '3' as unknown as number }, 'player1')).toBe(false);
      expect(game.validateMove(initialState, undefined as unknown as { column: number }, 'player1')).toBe(false);
    });

    it('should reject a full column', () => {
      const state: ConnectFourGameState = {
        ...initialState,
        board: boardFrom(['R......', 'Y......', 'R......', 'Y......', 'R......', 'Y......'])
      };

      expect(game.validateMove(state, { column: 0 }, 'player1')).toBe(false);
    });
  });

  describe('applyMove', () => {
    it('should drop the disc to the bottom row and switch turns', () => {
      const next = game.applyMove(initialState, { column: 3 }, 'player1');

      expect(next.board[5][3]).toBe('R');
      expect(next.currentPlayerId).toBe('ai');
      expect(next.lastMove).toEqual({ row: 5, column: 3 });
    });

    it('should stack discs on top of existing ones', () => {
      const afterRed = game.applyMove(initialState, { column: 3 }, 'player1');
      const afterYellow = game.applyMove(afterRed, { column: 3 }, 'ai');

      expect(afterYellow.board[5][3]).toBe('R');
      expect(afterYellow.board[4][3]).toBe('Y');
      expect(afterYellow.lastMove).toEqual({ row: 4, column: 3 });
    });

    it('should not mutate the original board', () => {
      game.applyMove(initialState, { column: 0 }, 'player1');

      expect(initialState.board[5][0]).toBeNull();
    });

    it('should throw on an invalid move', () => {
      expect(() => game.applyMove(initialState, { column: 9 }, 'player1')).toThrow('Invalid move');
    });
  });

  describe('checkGameEnd', () => {
    const withBoard = (rows: string[]): ConnectFourGameState => ({ ...initialState, board: boardFrom(rows) });

    it('should return null while nobody has four in a row', () => {
      expect(game.checkGameEnd(initialState)).toBeNull();
      expect(game.checkGameEnd(withBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'RRR.YYY']))).toBeNull();
    });

    it('should detect a horizontal four', () => {
      const result = game.checkGameEnd(withBoard([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...YYY.', '..RRRR.']));

      expect(result?.winner).toBe('player1');
      expect(result?.reason).toContain('horizontal');
    });

    it('should detect a vertical four', () => {
      const result = game.checkGameEnd(withBoard([EMPTY_ROW, EMPTY_ROW, '......Y', '.R....Y', '.R....Y', '.R....Y']));

      expect(result?.winner).toBe('ai');
      expect(result?.reason).toContain('vertical');
    });

    it('should detect an ascending diagonal four', () => {
      const result = game.checkGameEnd(withBoard([EMPTY_ROW, EMPTY_ROW, '...R...', '..RY...', '.RYY...', 'RYYR...']));

      expect(result?.winner).toBe('player1');
      expect(result?.reason).toContain('diagonal');
    });

    it('should detect a descending diagonal four', () => {
      const result = game.checkGameEnd(withBoard([EMPTY_ROW, EMPTY_ROW, 'Y......', 'RY.....', 'RRY....', 'RRRY...']));

      expect(result?.winner).toBe('ai');
      expect(result?.reason).toContain('diagonal');
    });

    it('should declare a draw when the board is full without a winner', () => {
      const result = game.checkGameEnd(withBoard([
        'RRYYRRY',
        'YYRRYYR',
        'RRYYRRY',
        'YYRRYYR',
        'RRYYRRY',
        'YYRRYYR'
      ]));

      expect(result).toEqual({ winner: 'draw', reason: 'Board is full' });
    });
  });

  describe('getValidMoves', () => {
    it('should return every column on an empty board', () => {
      expect(game.getValidMoves(initialState, 'player1')).toEqual(
        [0, 1, 2, 3, 4, 5, 6].map(column => ({ column }))
      );
    });

    it('should skip full columns', () => {
      const state: ConnectFourGameState = {
        ...initialState,
        board: boardFrom(['R.....Y', 'Y.....R', 'R.....Y', 'Y.....R', 'R.....Y', 'Y.....R'])
      };

      expect(game.getValidMoves(state, 'player1')).toEqual([1, 2, 3, 4, 5].map(column => ({ column })));
    });

    it('should return no moves when it is not the player turn', () => {
      expect(game.getValidMoves(initialState, 'ai')).toEqual([]);
    });
  });
});
