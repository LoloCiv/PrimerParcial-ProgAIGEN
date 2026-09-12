import json
import os
import sqlite3
from pathlib import Path

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

p = os.environ.get("GAMES_DB_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "games.db")

mcp = MCPServer("game-stats")


@mcp.tool()
def get_leaderboard(gameType: str | None = None, difficulty: str | None = None, limit: int = 10) -> str:
    """Ranking of players by wins and win rate (only finished games). Optional filters: gameType (tic-tac-toe, rock-paper-scissors, connect-four), difficulty (easy, medium, hard), limit (default 10)"""
    if gameType and gameType != "tic-tac-toe" and gameType != "rock-paper-scissors" and gameType != "connect-four":
        raise ToolError("Invalid gameType: " + gameType)
    if difficulty and difficulty != "easy" and difficulty != "medium" and difficulty != "hard":
        raise ToolError("Invalid difficulty: " + difficulty)
    if not os.path.exists(p):
        raise ToolError("Games database not found at " + p + ". Play a game in the web app or run: uv run python seed.py")
    db = sqlite3.connect(Path(p).resolve().as_uri() + "?mode=ro", uri=True)
    d = []
    try:
        x = db.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM rps_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM connect_four_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    db.close()
    d.sort(key=lambda x: x["gameState"]["updatedAt"])
    o = {}
    n = 0
    for i in range(len(d)):
        g = d[i]
        if g["gameState"]["status"] != "finished":
            continue
        if gameType and g["gameType"] != gameType:
            continue
        if difficulty and (g.get("difficulty") or "medium") != difficulty:
            continue
        n = n + 1
        nm = "Player"
        for pl in g["gameState"]["players"]:
            if not pl["isAI"]:
                nm = pl["name"]
        nm = nm.strip()
        k = nm.lower()
        if k not in o:
            o[k] = {"player": nm, "played": 0, "wins": 0, "losses": 0, "draws": 0}
        o[k]["played"] = o[k]["played"] + 1
        if g["gameState"].get("winner") == "player1":
            o[k]["wins"] = o[k]["wins"] + 1
        elif g["gameState"].get("winner") == "ai":
            o[k]["losses"] = o[k]["losses"] + 1
        elif g["gameState"].get("winner") == "draw":
            o[k]["draws"] = o[k]["draws"] + 1
    r = list(o.values())
    for i in range(len(r)):
        if r[i]["played"] == 0:
            r[i]["winRate"] = 0
        else:
            r[i]["winRate"] = round(r[i]["wins"] / r[i]["played"] * 1000) / 10
    r.sort(key=lambda x: (-x["wins"], -x["winRate"], x["player"]))
    r = r[:limit]
    tmp = []
    for i in range(len(r)):
        tmp.append({"rank": i + 1, "player": r[i]["player"], "played": r[i]["played"], "wins": r[i]["wins"], "losses": r[i]["losses"], "draws": r[i]["draws"], "winRate": r[i]["winRate"]})
    res = {"filters": {"gameType": gameType or "all", "difficulty": difficulty or "all"}, "totalFinishedGames": n, "leaderboard": tmp}
    if n == 0:
        res["message"] = "No finished games yet. Play a game in the web app or run: uv run python seed.py"
    return json.dumps(res, indent=2)


@mcp.tool()
def get_player_stats(playerName: str) -> str:
    """Wins, losses and draws of one player by game and difficulty, current streak and last 5 results. The name is matched ignoring case and spaces"""
    if not playerName or playerName.strip() == "":
        raise ToolError("playerName is required")
    if not os.path.exists(p):
        raise ToolError("Games database not found at " + p + ". Play a game in the web app or run: uv run python seed.py")
    db = sqlite3.connect(Path(p).resolve().as_uri() + "?mode=ro", uri=True)
    d = []
    try:
        x = db.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM rps_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM connect_four_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    db.close()
    d.sort(key=lambda x: x["gameState"]["updatedAt"])
    k = playerName.strip().lower()
    nm = ""
    t = {"played": 0, "wins": 0, "losses": 0, "draws": 0}
    bg = {}
    bd = {}
    arr = []
    ip = 0
    for i in range(len(d)):
        g = d[i]
        pn = "Player"
        for pl in g["gameState"]["players"]:
            if not pl["isAI"]:
                pn = pl["name"]
        pn = pn.strip()
        if pn.lower() != k:
            continue
        if g["gameState"]["status"] != "finished":
            ip = ip + 1
            continue
        if nm == "":
            nm = pn
        df = g.get("difficulty") or "medium"
        t["played"] = t["played"] + 1
        if g["gameType"] not in bg:
            bg[g["gameType"]] = {"played": 0, "wins": 0, "losses": 0, "draws": 0}
        bg[g["gameType"]]["played"] = bg[g["gameType"]]["played"] + 1
        if df not in bd:
            bd[df] = {"played": 0, "wins": 0, "losses": 0, "draws": 0}
        bd[df]["played"] = bd[df]["played"] + 1
        rs = ""
        if g["gameState"].get("winner") == "player1":
            t["wins"] = t["wins"] + 1
            bg[g["gameType"]]["wins"] = bg[g["gameType"]]["wins"] + 1
            bd[df]["wins"] = bd[df]["wins"] + 1
            rs = "win"
        elif g["gameState"].get("winner") == "ai":
            t["losses"] = t["losses"] + 1
            bg[g["gameType"]]["losses"] = bg[g["gameType"]]["losses"] + 1
            bd[df]["losses"] = bd[df]["losses"] + 1
            rs = "loss"
        elif g["gameState"].get("winner") == "draw":
            t["draws"] = t["draws"] + 1
            bg[g["gameType"]]["draws"] = bg[g["gameType"]]["draws"] + 1
            bd[df]["draws"] = bd[df]["draws"] + 1
            rs = "draw"
        arr.append({"gameId": g["gameState"]["id"], "gameType": g["gameType"], "difficulty": df, "result": rs, "finishedAt": g["gameState"]["updatedAt"]})
    if t["played"] == 0:
        raise ToolError('No finished games found for player "' + playerName + '"')
    t["winRate"] = round(t["wins"] / t["played"] * 1000) / 10
    for x in bg:
        bg[x]["winRate"] = round(bg[x]["wins"] / bg[x]["played"] * 1000) / 10
    for x in bd:
        bd[x]["winRate"] = round(bd[x]["wins"] / bd[x]["played"] * 1000) / 10
    arr.reverse()
    st = None
    for i in range(len(arr)):
        if st is None:
            st = {"result": arr[i]["result"], "count": 1}
        elif arr[i]["result"] == st["result"]:
            st["count"] = st["count"] + 1
        else:
            break
    res = {"player": nm, "totals": t, "byGame": bg, "byDifficulty": bd, "currentStreak": st, "lastResults": arr[:5], "inProgress": ip}
    return json.dumps(res, indent=2)


@mcp.tool()
def get_ai_performance(gameType: str | None = None) -> str:
    """How often the AI wins, loses and draws on each difficulty (only finished games). Optional filter: gameType (tic-tac-toe, rock-paper-scissors, connect-four)"""
    if gameType and gameType != "tic-tac-toe" and gameType != "rock-paper-scissors" and gameType != "connect-four":
        raise ToolError("Invalid gameType: " + gameType)
    if not os.path.exists(p):
        raise ToolError("Games database not found at " + p + ". Play a game in the web app or run: uv run python seed.py")
    db = sqlite3.connect(Path(p).resolve().as_uri() + "?mode=ro", uri=True)
    d = []
    try:
        x = db.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM rps_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM connect_four_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    db.close()
    o = {}
    n = 0
    for i in range(len(d)):
        g = d[i]
        if g["gameState"]["status"] != "finished":
            continue
        if gameType and g["gameType"] != gameType:
            continue
        n = n + 1
        df = g.get("difficulty") or "medium"
        if df not in o:
            o[df] = {"difficulty": df, "played": 0, "aiWins": 0, "aiLosses": 0, "draws": 0}
        o[df]["played"] = o[df]["played"] + 1
        if g["gameState"].get("winner") == "ai":
            o[df]["aiWins"] = o[df]["aiWins"] + 1
        elif g["gameState"].get("winner") == "player1":
            o[df]["aiLosses"] = o[df]["aiLosses"] + 1
        elif g["gameState"].get("winner") == "draw":
            o[df]["draws"] = o[df]["draws"] + 1
    r = []
    lv = ["easy", "medium", "hard"]
    for i in range(len(lv)):
        if lv[i] in o:
            o[lv[i]]["aiWinRate"] = round(o[lv[i]]["aiWins"] / o[lv[i]]["played"] * 1000) / 10
            r.append(o[lv[i]])
    res = {"filters": {"gameType": gameType or "all"}, "byDifficulty": r}
    if n == 0:
        res["message"] = "No finished games yet. Play a game in the web app or run: uv run python seed.py"
    return json.dumps(res, indent=2)


@mcp.tool()
def get_recent_games(limit: int = 10, gameType: str | None = None, playerName: str | None = None) -> str:
    """Latest finished games, newest first. Optional filters: limit (default 10), gameType (tic-tac-toe, rock-paper-scissors, connect-four), playerName"""
    if gameType and gameType != "tic-tac-toe" and gameType != "rock-paper-scissors" and gameType != "connect-four":
        raise ToolError("Invalid gameType: " + gameType)
    if not os.path.exists(p):
        raise ToolError("Games database not found at " + p + ". Play a game in the web app or run: uv run python seed.py")
    db = sqlite3.connect(Path(p).resolve().as_uri() + "?mode=ro", uri=True)
    d = []
    try:
        x = db.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM rps_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    try:
        x = db.execute("SELECT game_session FROM connect_four_games").fetchall()
        for i in range(len(x)):
            d.append(json.loads(x[i][0]))
    except Exception:
        pass
    db.close()
    d.sort(key=lambda x: x["gameState"]["updatedAt"], reverse=True)
    r = []
    for i in range(len(d)):
        g = d[i]
        if g["gameState"]["status"] != "finished":
            continue
        if gameType and g["gameType"] != gameType:
            continue
        pn = "Player"
        for pl in g["gameState"]["players"]:
            if not pl["isAI"]:
                pn = pl["name"]
        pn = pn.strip()
        if playerName and pn.lower() != playerName.strip().lower():
            continue
        rs = "draw"
        if g["gameState"].get("winner") == "player1":
            rs = "win"
        if g["gameState"].get("winner") == "ai":
            rs = "loss"
        sc = None
        if g["gameType"] == "rock-paper-scissors" and g["gameState"].get("scores"):
            sc = str(g["gameState"]["scores"].get("player1", 0)) + "-" + str(g["gameState"]["scores"].get("ai", 0))
        r.append({"gameId": g["gameState"]["id"], "gameType": g["gameType"], "player": pn, "difficulty": g.get("difficulty") or "medium", "result": rs, "score": sc, "finishedAt": g["gameState"]["updatedAt"]})
        if len(r) >= limit:
            break
    res = {"games": r}
    if len(r) == 0:
        res["message"] = "No finished games found"
    return json.dumps(res, indent=2)


if __name__ == "__main__":
    mcp.run()
