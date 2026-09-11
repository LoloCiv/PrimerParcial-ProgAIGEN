import { Game, Player, PlayerId, GameResult } from '../types/game';
import { ConnectFourGameState, ConnectFourMove, ConnectFourBoard, ConnectFourDisc } from '../types/games';

/**
 * Directions checked when looking for four in a row
 */
const LINE_DIRECTIONS = [
  { rowStep: 0, columnStep: 1, name: 'horizontal' },
  { rowStep: 1, columnStep: 0, name: 'vertical' },
  { rowStep: 1, columnStep: 1, name: 'diagonal' },
  { rowStep: -1, columnStep: 1, name: 'diagonal' },
] as const;

/**
 * Implementation of the classic Connect Four game
 *
 * Players take turns dropping discs into a 6x7 grid. A disc falls to the
 * lowest empty cell of the chosen column. The first player to line up four
 * discs horizontally, vertically or diagonally wins. If the board fills up
 * without four in a row, the game is a draw.
 *
 * @example
 * ```typescript
 * const game = new ConnectFourGame();
 * const players = [
 *   { id: 'player1', name: 'Alice', isAI: false },
 *   { id: 'ai', name: 'Computer', isAI: true }
 * ];
 * const initialState = game.getInitialState(players);
 * const next = game.applyMove(initialState, { column: 3 }, 'player1');
 * ```
 */
export class ConnectFourGame implements Game<ConnectFourGameState, ConnectFourMove> {
  static readonly ROWS = 6;
  static readonly COLUMNS = 7;

  /**
   * Validates whether a move is legal in the current game state
   *
   * @description
   * A move is valid if:
   * - It's the player's turn
   * - The column is an integer between 0 and 6
   * - The column is not full (its top cell is empty)
   */
  validateMove(gameState: ConnectFourGameState, move: ConnectFourMove, playerId: PlayerId): boolean {
    if (gameState.currentPlayerId !== playerId) {
      return false;
    }

    const column = move?.column;
    if (
      typeof column !== 'number' ||
      !Number.isInteger(column) ||
      column < 0 || column >= ConnectFourGame.COLUMNS
    ) {
      return false;
    }

    return gameState.board[0][column] === null;
  }

  /**
   * Drops the player's disc into the chosen column and passes the turn
   *
   * @throws Error if the move is invalid
   */
  applyMove(gameState: ConnectFourGameState, move: ConnectFourMove, playerId: PlayerId): ConnectFourGameState {
    if (!this.validateMove(gameState, move, playerId)) {
      throw new Error('Invalid move');
    }

    const { column } = move;
    const row = this.getDropRow(gameState.board, column);

    const newBoard = gameState.board.map(boardRow => [...boardRow]);
    newBoard[row][column] = gameState.playerDiscs[playerId];

    const nextPlayerId = gameState.players.find(p => p.id !== playerId)?.id || 'player1';

    return {
      ...gameState,
      board: newBoard,
      currentPlayerId: nextPlayerId,
      lastMove: { row, column },
      updatedAt: new Date(),
    };
  }

  /**
   * Checks if the game has ended and determines the winner
   *
   * @returns GameResult with winner and reason if game ended, null if game continues
   */
  checkGameEnd(gameState: ConnectFourGameState): GameResult | null {
    const { board } = gameState;

    for (let row = 0; row < ConnectFourGame.ROWS; row++) {
      for (let column = 0; column < ConnectFourGame.COLUMNS; column++) {
        const disc = board[row][column];
        if (!disc) continue;

        for (const direction of LINE_DIRECTIONS) {
          if (this.hasFourFrom(board, row, column, direction.rowStep, direction.columnStep)) {
            return {
              winner: this.getPlayerIdByDisc(gameState, disc),
              reason: `Four in a row (${direction.name})`,
            };
          }
        }
      }
    }

    const isBoardFull = board.every(boardRow => boardRow.every(cell => cell !== null));
    if (isBoardFull) {
      return { winner: 'draw', reason: 'Board is full' };
    }

    return null;
  }

  /**
   * Gets every column that still has space, or an empty array if it's not the player's turn
   */
  getValidMoves(gameState: ConnectFourGameState, playerId: PlayerId): ConnectFourMove[] {
    if (gameState.currentPlayerId !== playerId) {
      return [];
    }

    const validMoves: ConnectFourMove[] = [];
    for (let column = 0; column < ConnectFourGame.COLUMNS; column++) {
      if (gameState.board[0][column] === null) {
        validMoves.push({ column });
      }
    }
    return validMoves;
  }

  /**
   * Creates the initial game state with an empty board
   *
   * @description
   * The first player gets red ('R') and moves first, the second player gets
   * yellow ('Y'). Pass `firstPlayerId` to choose who starts.
   */
  getInitialState(players: Player[], options?: { firstPlayerId?: string }): ConnectFourGameState {
    const board: ConnectFourBoard = Array.from(
      { length: ConnectFourGame.ROWS },
      () => Array(ConnectFourGame.COLUMNS).fill(null)
    );

    const requestedIndex = options?.firstPlayerId
      ? players.findIndex(p => p.id === options.firstPlayerId)
      : -1;
    const firstPlayerIndex = requestedIndex === -1 ? 0 : requestedIndex;
    const firstPlayer = players[firstPlayerIndex];
    const secondPlayer = players[1 - firstPlayerIndex];

    const playerDiscs: Record<string, ConnectFourDisc> = {};
    playerDiscs[firstPlayer.id] = 'R';
    playerDiscs[secondPlayer.id] = 'Y';

    return {
      id: crypto.randomUUID(),
      players,
      currentPlayerId: firstPlayer.id,
      status: 'playing',
      createdAt: new Date(),
      updatedAt: new Date(),
      board,
      playerDiscs,
    };
  }

  /**
   * Finds the lowest empty row in a column (-1 if the column is full)
   */
  private getDropRow(board: ConnectFourBoard, column: number): number {
    for (let row = ConnectFourGame.ROWS - 1; row >= 0; row--) {
      if (board[row][column] === null) {
        return row;
      }
    }
    return -1;
  }

  /**
   * Checks whether the disc at (row, column) starts a line of four in the given direction
   */
  private hasFourFrom(board: ConnectFourBoard, row: number, column: number, rowStep: number, columnStep: number): boolean {
    const disc = board[row][column];
    for (let step = 1; step < 4; step++) {
      const r = row + rowStep * step;
      const c = column + columnStep * step;
      if (r < 0 || r >= ConnectFourGame.ROWS || c < 0 || c >= ConnectFourGame.COLUMNS || board[r][c] !== disc) {
        return false;
      }
    }
    return true;
  }

  /**
   * Finds the player that owns a disc colour ('player1' as fallback)
   */
  private getPlayerIdByDisc(gameState: ConnectFourGameState, disc: ConnectFourDisc): PlayerId {
    for (const [playerId, playerDisc] of Object.entries(gameState.playerDiscs)) {
      if (playerDisc === disc) {
        return playerId as PlayerId;
      }
    }
    return 'player1';
  }
}
