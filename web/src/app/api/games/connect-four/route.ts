import { NextRequest, NextResponse } from 'next/server'
import { ConnectFourGame } from '@turn-based-mcp/shared'
import type { GameSession, Player, ConnectFourGameState } from '@turn-based-mcp/shared'
import { setConnectFourGame, getAllConnectFourGames, deleteConnectFourGame } from '../../../../lib/game-storage'

const connectFourGame = new ConnectFourGame()

export async function POST(request: NextRequest) {
  try {
    const { playerName, gameId, difficulty, playerColor } = await request.json()

    const players: Player[] = [
      { id: 'player1', name: playerName || 'Player', isAI: false },
      { id: 'ai', name: 'AI', isAI: true }
    ]

    // Red always moves first, so picking yellow lets the AI start
    const gameState = connectFourGame.getInitialState(players, {
      firstPlayerId: playerColor === 'yellow' ? 'ai' : 'player1'
    })

    // Use custom gameId if provided
    if (gameId) {
      gameState.id = gameId
    }

    const gameSession: GameSession<ConnectFourGameState> = {
      gameState,
      gameType: 'connect-four',
      history: [],
      difficulty: difficulty || 'medium'
    }

    await setConnectFourGame(gameState.id, gameSession)

    return NextResponse.json(gameSession)
  } catch (error) {
    console.error('Error creating game:', error)
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(await getAllConnectFourGames())
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteConnectFourGame(gameId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting game:', error)
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    )
  }
}
