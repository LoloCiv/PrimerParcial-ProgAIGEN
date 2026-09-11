#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createStatsServer } from './server.js'

// Defaults to the database the web app writes to (web/games.db)
const DEFAULT_DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/games.db')

async function main(): Promise<void> {
  const dbPath = process.env.GAMES_DB_PATH || DEFAULT_DB_PATH
  const server = createStatsServer(dbPath)

  await server.connect(new StdioServerTransport())
  console.error(`Game stats MCP server running on stdio (database: ${dbPath})`)
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
