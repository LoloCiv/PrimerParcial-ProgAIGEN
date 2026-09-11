import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import Database from 'better-sqlite3'
import fs from 'fs'

export function createStatsServer(p: string) {
  const s = new Server({ name: 'game-stats-mcp', version: '1.0.0' }, { capabilities: { tools: {} } })

  s.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_leaderboard',
          description: 'Ranking of players by wins and win rate (only finished games). Optional filters: gameType, difficulty, limit',
          inputSchema: {
            type: 'object',
            properties: {
              gameType: { type: 'string', enum: ['tic-tac-toe', 'rock-paper-scissors', 'connect-four'] },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
              limit: { type: 'number', description: 'Max players to return (default 10)' }
            }
          }
        },
        {
          name: 'get_player_stats',
          description: 'Wins, losses and draws of one player by game and difficulty, current streak and last results',
          inputSchema: {
            type: 'object',
            properties: {
              playerName: { type: 'string', description: 'Player name (case insensitive)' }
            },
            required: ['playerName']
          }
        },
        {
          name: 'get_ai_performance',
          description: 'How often the AI wins, loses and draws on each difficulty. Optional filter: gameType',
          inputSchema: {
            type: 'object',
            properties: {
              gameType: { type: 'string', enum: ['tic-tac-toe', 'rock-paper-scissors', 'connect-four'] }
            }
          }
        },
        {
          name: 'get_recent_games',
          description: 'Latest finished games, newest first. Optional filters: limit, gameType, playerName',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max games to return (default 10)' },
              gameType: { type: 'string', enum: ['tic-tac-toe', 'rock-paper-scissors', 'connect-four'] },
              playerName: { type: 'string' }
            }
          }
        }
      ]
    }
  })

  s.setRequestHandler(CallToolRequestSchema, async (req) => {
    const a: any = req.params.arguments || {}
    try {
      if (req.params.name == 'get_leaderboard') {
        if (a.gameType && a.gameType != 'tic-tac-toe' && a.gameType != 'rock-paper-scissors' && a.gameType != 'connect-four') throw new Error('Invalid gameType: ' + a.gameType)
        if (a.difficulty && a.difficulty != 'easy' && a.difficulty != 'medium' && a.difficulty != 'hard') throw new Error('Invalid difficulty: ' + a.difficulty)
        if (!fs.existsSync(p)) throw new Error('Games database not found at ' + p + '. Play a game in the web app or run: npm run seed')
        const db = new Database(p, { readonly: true })
        const d: any[] = []
        try {
          const x: any = db.prepare('SELECT game_session FROM tic_tac_toe_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM rps_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM connect_four_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        db.close()
        d.sort((x: any, y: any) => new Date(x.gameState.updatedAt).getTime() - new Date(y.gameState.updatedAt).getTime())
        const o: any = {}
        let n = 0
        for (let i = 0; i < d.length; i++) {
          const g = d[i]
          if (g.gameState.status != 'finished') continue
          if (a.gameType && g.gameType != a.gameType) continue
          if (a.difficulty && (g.difficulty || 'medium') != a.difficulty) continue
          n++
          const nm = (g.gameState.players.find((pl: any) => !pl.isAI) || { name: 'Player' }).name.trim()
          const k = nm.toLowerCase()
          if (!o[k]) o[k] = { player: nm, played: 0, wins: 0, losses: 0, draws: 0 }
          o[k].played++
          if (g.gameState.winner == 'player1') o[k].wins++
          else if (g.gameState.winner == 'ai') o[k].losses++
          else if (g.gameState.winner == 'draw') o[k].draws++
        }
        let r: any[] = Object.values(o)
        for (let i = 0; i < r.length; i++) r[i].winRate = r[i].played == 0 ? 0 : Math.round(r[i].wins / r[i].played * 1000) / 10
        r.sort((x: any, y: any) => {
          if (y.wins != x.wins) return y.wins - x.wins
          if (y.winRate != x.winRate) return y.winRate - x.winRate
          return x.player.localeCompare(y.player)
        })
        r = r.slice(0, a.limit || 10)
        const tmp = r.map((x: any, i: number) => ({ rank: i + 1, player: x.player, played: x.played, wins: x.wins, losses: x.losses, draws: x.draws, winRate: x.winRate }))
        const res: any = { filters: { gameType: a.gameType || 'all', difficulty: a.difficulty || 'all' }, totalFinishedGames: n, leaderboard: tmp }
        if (n == 0) res.message = 'No finished games yet. Play a game in the web app or run: npm run seed'
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }
      } else if (req.params.name == 'get_player_stats') {
        if (!a.playerName || String(a.playerName).trim() == '') throw new Error('playerName is required')
        if (!fs.existsSync(p)) throw new Error('Games database not found at ' + p + '. Play a game in the web app or run: npm run seed')
        const db = new Database(p, { readonly: true })
        const d: any[] = []
        try {
          const x: any = db.prepare('SELECT game_session FROM tic_tac_toe_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM rps_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM connect_four_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        db.close()
        d.sort((x: any, y: any) => new Date(x.gameState.updatedAt).getTime() - new Date(y.gameState.updatedAt).getTime())
        const k = String(a.playerName).trim().toLowerCase()
        let nm = ''
        const t: any = { played: 0, wins: 0, losses: 0, draws: 0 }
        const bg: any = {}
        const bd: any = {}
        const arr: any[] = []
        let ip = 0
        for (let i = 0; i < d.length; i++) {
          const g = d[i]
          const pn = (g.gameState.players.find((pl: any) => !pl.isAI) || { name: 'Player' }).name.trim()
          if (pn.toLowerCase() != k) continue
          if (g.gameState.status != 'finished') {
            ip++
            continue
          }
          if (nm == '') nm = pn
          const df = g.difficulty || 'medium'
          t.played++
          if (!bg[g.gameType]) bg[g.gameType] = { played: 0, wins: 0, losses: 0, draws: 0 }
          bg[g.gameType].played++
          if (!bd[df]) bd[df] = { played: 0, wins: 0, losses: 0, draws: 0 }
          bd[df].played++
          let rs = ''
          if (g.gameState.winner == 'player1') {
            t.wins++
            bg[g.gameType].wins++
            bd[df].wins++
            rs = 'win'
          } else if (g.gameState.winner == 'ai') {
            t.losses++
            bg[g.gameType].losses++
            bd[df].losses++
            rs = 'loss'
          } else if (g.gameState.winner == 'draw') {
            t.draws++
            bg[g.gameType].draws++
            bd[df].draws++
            rs = 'draw'
          }
          arr.push({ gameId: g.gameState.id, gameType: g.gameType, difficulty: df, result: rs, finishedAt: g.gameState.updatedAt })
        }
        if (t.played == 0) throw new Error('No finished games found for player "' + a.playerName + '"')
        t.winRate = Math.round(t.wins / t.played * 1000) / 10
        for (const x in bg) bg[x].winRate = Math.round(bg[x].wins / bg[x].played * 1000) / 10
        for (const x in bd) bd[x].winRate = Math.round(bd[x].wins / bd[x].played * 1000) / 10
        arr.reverse()
        let st: any = null
        for (let i = 0; i < arr.length; i++) {
          if (st == null) st = { result: arr[i].result, count: 1 }
          else if (arr[i].result == st.result) st.count++
          else break
        }
        const res: any = { player: nm, totals: t, byGame: bg, byDifficulty: bd, currentStreak: st, lastResults: arr.slice(0, 5), inProgress: ip }
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }
      } else if (req.params.name == 'get_ai_performance') {
        if (a.gameType && a.gameType != 'tic-tac-toe' && a.gameType != 'rock-paper-scissors' && a.gameType != 'connect-four') throw new Error('Invalid gameType: ' + a.gameType)
        if (!fs.existsSync(p)) throw new Error('Games database not found at ' + p + '. Play a game in the web app or run: npm run seed')
        const db = new Database(p, { readonly: true })
        const d: any[] = []
        try {
          const x: any = db.prepare('SELECT game_session FROM tic_tac_toe_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM rps_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM connect_four_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        db.close()
        const o: any = {}
        let n = 0
        for (let i = 0; i < d.length; i++) {
          const g = d[i]
          if (g.gameState.status != 'finished') continue
          if (a.gameType && g.gameType != a.gameType) continue
          n++
          const df = g.difficulty || 'medium'
          if (!o[df]) o[df] = { difficulty: df, played: 0, aiWins: 0, aiLosses: 0, draws: 0 }
          o[df].played++
          if (g.gameState.winner == 'ai') o[df].aiWins++
          else if (g.gameState.winner == 'player1') o[df].aiLosses++
          else if (g.gameState.winner == 'draw') o[df].draws++
        }
        const r: any[] = []
        const lv = ['easy', 'medium', 'hard']
        for (let i = 0; i < lv.length; i++) {
          if (o[lv[i]]) {
            o[lv[i]].aiWinRate = Math.round(o[lv[i]].aiWins / o[lv[i]].played * 1000) / 10
            r.push(o[lv[i]])
          }
        }
        const res: any = { filters: { gameType: a.gameType || 'all' }, byDifficulty: r }
        if (n == 0) res.message = 'No finished games yet. Play a game in the web app or run: npm run seed'
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }
      } else if (req.params.name == 'get_recent_games') {
        if (a.gameType && a.gameType != 'tic-tac-toe' && a.gameType != 'rock-paper-scissors' && a.gameType != 'connect-four') throw new Error('Invalid gameType: ' + a.gameType)
        if (!fs.existsSync(p)) throw new Error('Games database not found at ' + p + '. Play a game in the web app or run: npm run seed')
        const db = new Database(p, { readonly: true })
        const d: any[] = []
        try {
          const x: any = db.prepare('SELECT game_session FROM tic_tac_toe_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM rps_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        try {
          const x: any = db.prepare('SELECT game_session FROM connect_four_games').all()
          for (let i = 0; i < x.length; i++) d.push(JSON.parse(x[i].game_session))
        } catch { /* table not there */ }
        db.close()
        d.sort((x: any, y: any) => new Date(y.gameState.updatedAt).getTime() - new Date(x.gameState.updatedAt).getTime())
        const r: any[] = []
        for (let i = 0; i < d.length; i++) {
          const g = d[i]
          if (g.gameState.status != 'finished') continue
          if (a.gameType && g.gameType != a.gameType) continue
          const pn = (g.gameState.players.find((pl: any) => !pl.isAI) || { name: 'Player' }).name.trim()
          if (a.playerName && pn.toLowerCase() != String(a.playerName).trim().toLowerCase()) continue
          let rs = 'draw'
          if (g.gameState.winner == 'player1') rs = 'win'
          if (g.gameState.winner == 'ai') rs = 'loss'
          let sc: any = null
          if (g.gameType == 'rock-paper-scissors' && g.gameState.scores) sc = (g.gameState.scores.player1 || 0) + '-' + (g.gameState.scores.ai || 0)
          r.push({ gameId: g.gameState.id, gameType: g.gameType, player: pn, difficulty: g.difficulty || 'medium', result: rs, score: sc, finishedAt: g.gameState.updatedAt })
          if (r.length >= (a.limit || 10)) break
        }
        const res: any = { games: r }
        if (r.length == 0) res.message = 'No finished games found'
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] }
      } else {
        throw new Error('Unknown tool: ' + req.params.name)
      }
    } catch (e: any) {
      return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }
    }
  })

  return s
}
