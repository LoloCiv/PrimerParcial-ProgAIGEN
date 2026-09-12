"""Fills the games database with simulated finished games so the stats server has data to show.

Usage (from the repo root): uv run --directory stats-mcp python seed.py
Writes to web/games.db unless GAMES_DB_PATH points somewhere else. Every run adds 40 new games.
"""

import json
import os
import random
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "web" / "games.db"

TABLES = {
    "tic-tac-toe": "tic_tac_toe_games",
    "rock-paper-scissors": "rps_games",
    "connect-four": "connect_four_games",
}
DIFFICULTIES = ["easy", "medium", "hard"]

# Base chance of each simulated player beating the AI
PLAYER_SKILL = {"Ana": 0.65, "Bruno": 0.35, "Caro": 0.55, "Dani": 0.45}
# Added to the player's chance on each difficulty
DIFFICULTY_ADJUSTMENT = {"easy": 0.15, "medium": -0.1, "hard": -0.3}
DRAW_CHANCE = 0.12

# Best of 3 final scores (player-ai) that match each winner
RPS_SCORES = {"player1": [(2, 0), (2, 1)], "ai": [(0, 2), (1, 2)], "draw": [(1, 1), (0, 0)]}

GAMES_PER_PLAYER = 10
SEED_DAYS = 14


def to_iso(moment: datetime) -> str:
    """Same format the web app stores (JavaScript Date JSON): 2026-09-10T16:51:45.258Z"""
    return moment.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def pick_winner(skill: float, difficulty: str) -> str:
    if random.random() < DRAW_CHANCE:
        return "draw"
    return "player1" if random.random() < skill + DIFFICULTY_ADJUSTMENT[difficulty] else "ai"


def build_session(player: str, game_type: str, difficulty: str, winner: str, finished_at: datetime) -> dict:
    game_state = {
        "id": str(uuid.uuid4()),
        "players": [
            {"id": "player1", "name": player, "isAI": False},
            {"id": "ai", "name": "AI", "isAI": True},
        ],
        "currentPlayerId": "player1",
        "status": "finished",
        "winner": winner,
        "createdAt": to_iso(finished_at - timedelta(minutes=random.randint(2, 10))),
        "updatedAt": to_iso(finished_at),
    }

    # Minimal game-specific fields so the web app and the games MCP can still open these games
    if game_type == "tic-tac-toe":
        game_state["board"] = [[None] * 3 for _ in range(3)]
        game_state["playerSymbols"] = {"player1": "X", "ai": "O"}
    elif game_type == "connect-four":
        game_state["board"] = [[None] * 7 for _ in range(6)]
        game_state["playerDiscs"] = {"player1": "R", "ai": "Y"}
    else:
        player_score, ai_score = random.choice(RPS_SCORES[winner])
        game_state["rounds"] = [{}, {}, {}]
        game_state["currentRound"] = 3
        game_state["maxRounds"] = 3
        game_state["scores"] = {"player1": player_score, "ai": ai_score}

    return {"gameState": game_state, "gameType": game_type, "history": [], "difficulty": difficulty}


def main() -> None:
    db_path = Path(os.environ.get("GAMES_DB_PATH") or DEFAULT_DB_PATH)
    now = datetime.now(timezone.utc)
    game_types = list(TABLES)

    sessions = []
    for player, skill in PLAYER_SKILL.items():
        for i in range(GAMES_PER_PLAYER):
            game_type = game_types[i % len(game_types)]
            difficulty = random.choice(DIFFICULTIES)
            winner = pick_winner(skill, difficulty)
            finished_at = now - timedelta(seconds=random.uniform(0, SEED_DAYS * 24 * 3600))
            sessions.append(build_session(player, game_type, difficulty, winner, finished_at))

    db = sqlite3.connect(db_path)
    with db:
        for table in TABLES.values():
            db.execute(
                f"""CREATE TABLE IF NOT EXISTS {table} (
                    id TEXT PRIMARY KEY,
                    game_session TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )"""
            )
        for session in sessions:
            state = session["gameState"]
            db.execute(
                f"INSERT OR REPLACE INTO {TABLES[session['gameType']]} (id, game_session, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (state["id"], json.dumps(session), state["createdAt"][:19].replace("T", " "), state["updatedAt"][:19].replace("T", " ")),
            )
    db.close()

    print(f"Seeded {len(sessions)} finished games for {', '.join(PLAYER_SKILL)} into {db_path}")


if __name__ == "__main__":
    main()
