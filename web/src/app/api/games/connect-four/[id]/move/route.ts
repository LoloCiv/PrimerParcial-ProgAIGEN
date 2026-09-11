import { NextRequest, NextResponse } from 'next/server'
import { ConnectFourGame, getConnectFourGame, setConnectFourGame } from '@turn-based-mcp/shared'
import type { GameMove, ConnectFourMove } from '@turn-based-mcp/shared'

const connectFourGame = new ConnectFourGame()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { move, playerId } = await request.json()
    const { id: gameId } = await params

    const gameSession = await getConnectFourGame(gameId)
    if (!gameSession) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    if (!connectFourGame.validateMove(gameSession.gameState, move, playerId)) {
      return NextResponse.json(
        { error: 'Invalid move' },
        { status: 400 }
      )
    }

    let updatedGameState = connectFourGame.applyMove(gameSession.gameState, move, playerId)

    const playerMove: GameMove<ConnectFourMove> = {
      playerId,
      move,
      timestamp: new Date()
    }
    gameSession.history.push(playerMove)

    const gameResult = connectFourGame.checkGameEnd(updatedGameState)
    if (gameResult) {
      updatedGameState = {
        ...updatedGameState,
        status: 'finished',
        winner: gameResult.winner
      }
    }

    // AI moves are made externally through the MCP server
    gameSession.gameState = updatedGameState
    await setConnectFourGame(gameId, gameSession)

    return NextResponse.json(gameSession)
  } catch (error) {
    console.error('Error processing move:', error)
    return NextResponse.json(
      { error: 'Failed to process move' },
      { status: 500 }
    )
  }
}
