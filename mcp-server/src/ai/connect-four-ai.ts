import type { ConnectFourGameState, ConnectFourMove, ConnectFourDisc, Difficulty, PlayerId } from '@turn-based-mcp/shared'
import { ConnectFourGame } from '@turn-based-mcp/shared'

/** How many moves (plies) the hard AI looks ahead */
const HARD_SEARCH_DEPTH = 6
const WIN_SCORE = 1_000_000
const CENTER_COLUMN = 3

/**
 * Every group of 4 aligned cells on the board, precomputed once.
 * Used by the heuristic to score how promising a position is.
 */
const WINDOWS: Array<Array<[number, number]>> = ((): Array<Array<[number, number]>> => {
  const directions: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [-1, 1]]
  const windows: Array<Array<[number, number]>> = []

  for (let row = 0; row < ConnectFourGame.ROWS; row++) {
    for (let column = 0; column < ConnectFourGame.COLUMNS; column++) {
      for (const [rowStep, columnStep] of directions) {
        const cells = [0, 1, 2, 3].map((step): [number, number] => [row + rowStep * step, column + columnStep * step])
        const fitsOnBoard = cells.every(([r, c]) => r >= 0 && r < ConnectFourGame.ROWS && c >= 0 && c < ConnectFourGame.COLUMNS)
        if (fitsOnBoard) {
          windows.push(cells)
        }
      }
    }
  }

  return windows
})()

/**
 * AI opponent for Connect Four with configurable difficulty levels
 *
 * Provides three difficulty levels:
 * - Easy: Random column
 * - Medium: Win > block > safest column closest to the center
 * - Hard: Minimax with alpha-beta pruning and a positional heuristic
 *
 * @example
 * ```typescript
 * const ai = new ConnectFourAI();
 * const move = await ai.makeMove(gameState, 'hard'); // { column: 3 }
 * ```
 */
export class ConnectFourAI {
  private game = new ConnectFourGame()

  /**
   * Makes an AI move based on the specified difficulty level
   *
   * @throws Error if no valid moves are available
   */
  async makeMove(gameState: ConnectFourGameState, difficulty: Difficulty = 'medium'): Promise<ConnectFourMove> {
    const validMoves = this.game.getValidMoves(gameState, 'ai')

    if (validMoves.length === 0) {
      throw new Error('No valid moves available')
    }

    switch (difficulty) {
      case 'easy':
        return this.makeRandomMove(validMoves)
      case 'medium':
        return this.makeMediumMove(gameState, validMoves)
      case 'hard':
        return this.makeOptimalMove(gameState, validMoves)
      default:
        return this.makeRandomMove(validMoves)
    }
  }

  private makeRandomMove(validMoves: ConnectFourMove[]): ConnectFourMove {
    return validMoves[Math.floor(Math.random() * validMoves.length)]
  }

  /**
   * Priority order:
   * 1. Win immediately if possible
   * 2. Block the player's immediate win
   * 3. Column closest to the center that doesn't let the player win on top of it
   */
  private makeMediumMove(gameState: ConnectFourGameState, validMoves: ConnectFourMove[]): ConnectFourMove {
    const winMove = this.findWinningMove(gameState, 'ai')
    if (winMove) return winMove

    const blockMove = this.findWinningMove(gameState, 'player1')
    if (blockMove) return blockMove

    const centerFirst = this.orderCenterFirst(validMoves)
    return centerFirst.find(move => !this.givesPlayerAWin(gameState, move)) ?? centerFirst[0]
  }

  /**
   * Picks the move with the best minimax score. Ties go to the column closest to the center.
   */
  private makeOptimalMove(gameState: ConnectFourGameState, validMoves: ConnectFourMove[]): ConnectFourMove {
    const centerFirst = this.orderCenterFirst(validMoves)
    let bestMove = centerFirst[0]
    let bestScore = -Infinity

    for (const move of centerFirst) {
      const nextState = this.game.applyMove(gameState, move, 'ai')
      const score = this.minimax(nextState, HARD_SEARCH_DEPTH - 1, bestScore, Infinity, false)

      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
    }

    return bestMove
  }

  /**
   * Minimax with alpha-beta pruning
   *
   * @returns Score from the AI's point of view. Wins found earlier (more depth left) score higher.
   */
  private minimax(gameState: ConnectFourGameState, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    const result = this.game.checkGameEnd(gameState)
    if (result) {
      if (result.winner === 'ai') return WIN_SCORE + depth
      if (result.winner === 'player1') return -WIN_SCORE - depth
      return 0
    }

    if (depth === 0) {
      return this.evaluatePosition(gameState)
    }

    const playerId: PlayerId = isMaximizing ? 'ai' : 'player1'
    const moves = this.orderCenterFirst(this.game.getValidMoves(gameState, playerId))

    if (isMaximizing) {
      let maxScore = -Infinity
      for (const move of moves) {
        const score = this.minimax(this.game.applyMove(gameState, move, playerId), depth - 1, alpha, beta, false)
        maxScore = Math.max(maxScore, score)
        alpha = Math.max(alpha, maxScore)
        if (alpha >= beta) break
      }
      return maxScore
    }

    let minScore = Infinity
    for (const move of moves) {
      const score = this.minimax(this.game.applyMove(gameState, move, playerId), depth - 1, alpha, beta, true)
      minScore = Math.min(minScore, score)
      beta = Math.min(beta, minScore)
      if (alpha >= beta) break
    }
    return minScore
  }

  /**
   * Scores a non-final position from the AI's point of view
   *
   * - Discs in the center column are worth more (they take part in more lines)
   * - Each window of 4 cells holding only one colour adds (AI) or subtracts (player) points
   */
  private evaluatePosition(gameState: ConnectFourGameState): number {
    const aiDisc = gameState.playerDiscs.ai
    const playerDisc = gameState.playerDiscs.player1
    const { board } = gameState
    let score = 0

    for (let row = 0; row < ConnectFourGame.ROWS; row++) {
      if (board[row][CENTER_COLUMN] === aiDisc) score += 3
      else if (board[row][CENTER_COLUMN] === playerDisc) score -= 3
    }

    for (const window of WINDOWS) {
      score += this.scoreWindow(gameState, window, aiDisc, playerDisc)
    }

    return score
  }

  private scoreWindow(gameState: ConnectFourGameState, window: Array<[number, number]>, aiDisc: ConnectFourDisc, playerDisc: ConnectFourDisc): number {
    let aiCount = 0
    let playerCount = 0
    for (const [row, column] of window) {
      const cell = gameState.board[row][column]
      if (cell === aiDisc) aiCount++
      else if (cell === playerDisc) playerCount++
    }
    const emptyCount = 4 - aiCount - playerCount

    if (aiCount === 3 && emptyCount === 1) return 5
    if (aiCount === 2 && emptyCount === 2) return 2
    if (playerCount === 3 && emptyCount === 1) return -4
    if (playerCount === 2 && emptyCount === 2) return -2
    return 0
  }

  /**
   * Finds a move that immediately wins the game for the given player, as if it were their turn
   */
  private findWinningMove(gameState: ConnectFourGameState, playerId: PlayerId): ConnectFourMove | null {
    const stateOnTurn = { ...gameState, currentPlayerId: playerId }

    for (const move of this.game.getValidMoves(stateOnTurn, playerId)) {
      const result = this.game.checkGameEnd(this.game.applyMove(stateOnTurn, move, playerId))
      if (result?.winner === playerId) {
        return move
      }
    }

    return null
  }

  /**
   * True if dropping the AI disc in this column leaves the player an immediate win
   */
  private givesPlayerAWin(gameState: ConnectFourGameState, move: ConnectFourMove): boolean {
    const afterAIMove = this.game.applyMove(gameState, move, 'ai')
    return this.findWinningMove(afterAIMove, 'player1') !== null
  }

  private orderCenterFirst(moves: ConnectFourMove[]): ConnectFourMove[] {
    return [...moves].sort((a, b) => Math.abs(a.column - CENTER_COLUMN) - Math.abs(b.column - CENTER_COLUMN))
  }
}
