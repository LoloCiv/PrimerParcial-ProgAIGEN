import * as gamesIndex from './index';
import { TicTacToeGame } from './tic-tac-toe';
import { RockPaperScissorsGame } from './rock-paper-scissors';
import { ConnectFourGame } from './connect-four';

describe('Games Index', () => {
  it('should export TicTacToeGame', () => {
    expect(gamesIndex.TicTacToeGame).toBe(TicTacToeGame);
    expect(gamesIndex.TicTacToeGame).toBeDefined();
  });

  it('should export RockPaperScissorsGame', () => {
    expect(gamesIndex.RockPaperScissorsGame).toBe(RockPaperScissorsGame);
    expect(gamesIndex.RockPaperScissorsGame).toBeDefined();
  });

  it('should export ConnectFourGame', () => {
    expect(gamesIndex.ConnectFourGame).toBe(ConnectFourGame);
    expect(gamesIndex.ConnectFourGame).toBeDefined();
  });

  it('should have correct number of exports', () => {
    const exports = Object.keys(gamesIndex);
    expect(exports).toHaveLength(3);
    expect(exports).toContain('TicTacToeGame');
    expect(exports).toContain('RockPaperScissorsGame');
    expect(exports).toContain('ConnectFourGame');
  });
});
