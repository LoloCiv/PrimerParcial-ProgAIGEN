import { NextResponse } from 'next/server'
import { getAllConnectFourGames } from '../../../../../lib/game-storage'

/**
 * Sanitized API endpoint for MCP server access
 * Connect Four has no hidden information (the board is visible to both players),
 * so games are returned as stored
 */
export async function GET() {
  try {
    const games = await getAllConnectFourGames()
    return NextResponse.json(games)
  } catch (error) {
    console.error('Error fetching games for MCP:', error)
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    )
  }
}
