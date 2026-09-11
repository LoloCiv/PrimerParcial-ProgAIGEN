import { ConnectFourAI } from './connect-four-ai.js';
import type { ConnectFourBoard, ConnectFourGameState, Player } from '@turn-based-mcp/shared';
import { ConnectFourGame } from '@turn-based-mcp/shared';

/**
 * Builds a board from 6 strings of 7 chars ('R', 'Y' or '.'), top row first
 */
function boardFrom(rows: string[]): ConnectFourBoard {
  return rows.map(row => row.split('').map(cell => (cell === '.' ? null : (cell as 'R' | 'Y'))));
}

const EMPTY_ROW = '.......';

describe('ConnectFourAI', () => {
  let ai: ConnectFourAI;
  let game: ConnectFourGame;
  let initialState: ConnectFourGameState;

  // Player is red ('R'), AI is yellow ('Y') and it's the AI's turn
  const aiToMove = (rows: string[]): ConnectFourGameState => ({ ...initialState, board: boardFrom(rows) });

  beforeEach(() => {
    ai = new ConnectFourAI();
    game = new ConnectFourGame();
    const players: Player[] = [
      { id: 'player1', name: 'Player', isAI: false },
      { id: 'ai', name: 'AI', isAI: true }
    ];
    initialState = { ...game.getInitialState(players), currentPlayerId: 'ai' };
  });

  describe('makeMove', () => {
    it.each(['easy', 'medium', 'hard'] as const)('should return a valid move on %s difficulty', async (difficulty) => {
      const move = await ai.makeMove(initialState, difficulty);

      expect(game.validateMove(initialState, move, 'ai')).toBe(true);
    });

    it('should throw when there are no valid moves', async () => {
      const notAITurn = { ...initialState, currentPlayerId: 'player1' as const };

      await expect(ai.makeMove(notAITurn, 'medium')).rejects.toThrow('No valid moves available');
    });

    describe('easy difficulty', () => {
      it('should only choose columns that have space', async () => {
        const state = aiToMove(['RRR.RRR', 'YYY.YYY', 'RRR.RRR', 'YYY.YYY', 'RRR.RRR', 'YYY.YYY']);

        const move = await ai.makeMove(state, 'easy');

        expect(move).toEqual({ column: 3 });
      });

      it('should vary its moves', async () => {
        const columns = new Set<number>();
        for (let i = 0; i < 20; i++) {
          columns.add((await ai.makeMove(initialState, 'easy')).column);
        }

        expect(columns.size).toBeGreaterThan(1);
      });
    });

    describe.each(['medium', 'hard'] as const)('%s difficulty', (difficulty) => {
      it('should take an immediate win', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'RRR....', 'YYY.R..']);

        expect(await ai.makeMove(state, difficulty)).toEqual({ column: 3 });
      });

      it('should block the player from winning', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'YY.....', 'RRR..Y.']);

        expect(await ai.makeMove(state, difficulty)).toEqual({ column: 3 });
      });

      it('should prefer winning over blocking', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, '......Y', '......Y', 'R.....Y', 'RRR...R']);

        expect(await ai.makeMove(state, difficulty)).toEqual({ column: 6 });
      });

      it('should not drop a disc that lets the player win on top of it', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'RRR....', 'YYR....']);

        const move = await ai.makeMove(state, difficulty);

        expect(move.column).not.toBe(3);
      });

      it('should play the center column on an empty board', async () => {
        const emptyBoardState = { ...initialState };

        expect(await ai.makeMove(emptyBoardState, difficulty)).toEqual({ column: 3 });
      });
    });

    describe('hard difficulty', () => {
      it('should set up a double threat that forces a win', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...RR..', '...YY..']);

        const move = await ai.makeMove(state, 'hard');

        expect([2, 5]).toContain(move.column);
      });

      it('should answer quickly in the middle of a game', async () => {
        const state = aiToMove([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '...R...', '..YYR..', '.RYRY..']);

        const start = Date.now();
        await ai.makeMove(state, 'hard');

        expect(Date.now() - start).toBeLessThan(3000);
      });
    });
  });
});
