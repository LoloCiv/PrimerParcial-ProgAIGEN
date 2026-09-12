# game-stats MCP (Python)

MCP server that opens the games database (`web/games.db`) **read-only** and answers who is winning and losing against the AI.
It is independent from the TypeScript monorepo: it only reads the SQLite file the web app writes.

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (or pip, see below)

## Tools

| Tool | Description |
|------|-------------|
| `get_leaderboard` | Ranking by wins and win rate. Filters: `gameType`, `difficulty`, `limit` |
| `get_player_stats` | Totals by game and difficulty, current streak and last 5 results of one player |
| `get_ai_performance` | AI wins, losses and draws on each difficulty. Filter: `gameType` |
| `get_recent_games` | Latest finished games, newest first. Filters: `limit`, `gameType`, `playerName` |

Only finished games count. Results are seen from the human player (`win` / `loss` / `draw`), and player names are matched ignoring case and spaces.

## Run

From the repo root:

```bash
uv run --directory stats-mcp python server.py
```

The server speaks MCP over stdio, so normally an MCP client starts it. VS Code (`.vscode/mcp.json`) example:

```json
{
  "servers": {
    "game-stats": {
      "type": "stdio",
      "command": "uv",
      "args": ["run", "--directory", "${workspaceFolder}/stats-mcp", "python", "server.py"]
    }
  }
}
```

The database path defaults to `../web/games.db` (relative to this folder). Override it with the `GAMES_DB_PATH` environment variable.

### Without uv

```bash
cd stats-mcp
python -m venv .venv
.venv\Scripts\activate
pip install "mcp>=2.2,<3"
python server.py
```

## Sample data

```bash
uv run --directory stats-mcp python seed.py
```

Adds 40 simulated finished games (players Ana, Bruno, Caro and Dani) to `web/games.db`. Every run adds 40 more.
