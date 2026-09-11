'use client'

import type { ConnectFourGameState, ConnectFourMove, ConnectFourCell } from '@turn-based-mcp/shared'

/**
 * Props for the ConnectFourBoard component
 */
interface ConnectFourBoardProps {
  /** Current state of the connect four game */
  gameState: ConnectFourGameState
  /** Callback function called when a player drops a disc */
  onMove: (move: ConnectFourMove) => void
  /** Whether the board should be disabled (e.g., during AI turn) */
  disabled?: boolean
}

const DISC_LABELS = { R: 'Red disc', Y: 'Yellow disc' } as const
const COLOR_NAMES = { R: 'Red', Y: 'Yellow' } as const

/**
 * Interactive Connect Four game board component
 *
 * Renders the 6x7 grid as 7 clickable columns: clicking anywhere in a column
 * drops a disc there. Highlights the last disc played and shows turn and
 * winner information, locking the board during the AI's turn.
 *
 * @param props - Component props
 * @returns JSX element representing the game board
 */
export function ConnectFourBoard({ gameState, onMove, disabled }: ConnectFourBoardProps) {
  const isPlaying = gameState.status === 'playing'
  const columnCount = gameState.board[0]?.length ?? 0
  const playerColor = COLOR_NAMES[gameState.playerDiscs.player1]
  const aiColor = COLOR_NAMES[gameState.playerDiscs.ai]

  const isColumnFull = (column: number) => gameState.board[0][column] !== null

  const handleColumnClick = (column: number) => {
    if (disabled || !isPlaying || isColumnFull(column)) {
      return
    }

    onMove({ column })
  }

  const renderCell = (cell: ConnectFourCell, row: number, column: number) => {
    const isLastMove = gameState.lastMove?.row === row && gameState.lastMove?.column === column

    let classes = 'aspect-square w-full rounded-full border-2 transition-colors duration-200 '
    if (cell === 'R') {
      classes += 'bg-red-500 border-red-600 '
    } else if (cell === 'Y') {
      classes += 'bg-yellow-400 border-yellow-500 '
    } else {
      classes += 'bg-white dark:bg-slate-800 border-blue-800/40 '
    }
    if (isLastMove) {
      classes += 'ring-4 ring-white/80 '
    }

    return (
      <div
        key={`${row}-${column}`}
        role="img"
        aria-label={cell ? DISC_LABELS[cell] : 'Empty cell'}
        className={classes}
      />
    )
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 relative">
      {disabled && gameState.currentPlayerId === 'ai' && isPlaying && (
        <div className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center z-10">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              🤖 AI&apos;s Turn - Board Locked
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-600 dark:bg-blue-700 rounded-xl p-3 max-w-md mx-auto shadow-inner">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: columnCount }, (_, column) => {
            const isClickable = !disabled && isPlaying && !isColumnFull(column)

            return (
              <button
                key={column}
                type="button"
                onClick={() => handleColumnClick(column)}
                disabled={!isClickable}
                aria-label={`Drop disc in column ${column + 1}`}
                className={`flex flex-col gap-1 sm:gap-2 rounded-lg p-1 transition-all duration-200 ${
                  isClickable ? 'hover:bg-blue-500 cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                {gameState.board.map((boardRow, row) => renderCell(boardRow[column], row, column))}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isPlaying && (
            <>
              Current turn: {' '}
              <span className="font-semibold">
                {gameState.currentPlayerId === 'player1' ? `Your turn (${playerColor})` : `AI thinking... (${aiColor})`}
              </span>
            </>
          )}
          {gameState.status === 'finished' && gameState.winner && (
            <span className="font-semibold text-lg">
              {gameState.winner === 'player1' && 'You won! 🎉'}
              {gameState.winner === 'ai' && 'AI won! 🤖'}
              {gameState.winner === 'draw' && "It's a draw! 🤝"}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
