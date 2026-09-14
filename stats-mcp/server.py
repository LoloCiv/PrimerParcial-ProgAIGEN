import json
import os
import sqlite3
from pathlib import Path

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

# servidor de estadisticas
rb = os.environ.get("GAMES_DB_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "games.db")

s = MCPServer("game-stats")


@s.tool(description="Ranking de jugadores por victorias y porcentaje de victorias (solo partidas terminadas). Filtros opcionales: tipoJuego (tic-tac-toe, rock-paper-scissors, connect-four), dificultad (easy, medium, hard), limite (por defecto 10)")
def obtener_ranking(tipoJuego=None, dificultad=None, limite=10):
    if tipoJuego == None or tipoJuego == "" or tipoJuego == "tic-tac-toe" or tipoJuego == "rock-paper-scissors" or tipoJuego == "connect-four":
        if dificultad == None or dificultad == "" or dificultad == "easy" or dificultad == "medium" or dificultad == "hard":
            if os.path.exists(rb):
                cx = sqlite3.connect(Path(rb).resolve().as_uri() + "?mode=ro", uri=True)
                d = []
                # cargo todo
                try:
                    fl = cx.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
                    i = 0
                    while i < len(fl):
                        d.append(json.loads(fl[i][0]))
                        i = i + 1
                except Exception:
                    pass
                try:
                    fl = cx.execute("SELECT game_session FROM rps_games").fetchall()
                    i = 0
                    while i < len(fl):
                        d.append(json.loads(fl[i][0]))
                        i = i + 1
                except Exception:
                    pass
                try:
                    fl = cx.execute("SELECT game_session FROM connect_four_games").fetchall()
                    i = 0
                    while i < len(fl):
                        d.append(json.loads(fl[i][0]))
                        i = i + 1
                except Exception:
                    pass
                cx.close()
                d.sort(key=lambda x: x["gameState"]["updatedAt"])
                o = {}
                n = 0
                i = 0
                while i < len(d):
                    pt = d[i]
                    if pt["gameState"]["status"] == "finished":
                        if tipoJuego == None or tipoJuego == "" or pt["gameType"] == tipoJuego:
                            aux = "medium"
                            if "difficulty" in pt.keys():
                                if pt["difficulty"] != None and pt["difficulty"] != "":
                                    aux = pt["difficulty"]
                            if dificultad == None or dificultad == "" or aux == dificultad:
                                n = n + 1
                                nom = "Player"
                                for jg in pt["gameState"]["players"]:
                                    if jg["isAI"] == False:
                                        nom = jg["name"]
                                nom = nom.strip()
                                cl = nom.lower()
                                ex = False
                                for c in o.keys():
                                    if c == cl:
                                        ex = True
                                if ex == False:
                                    o[cl] = {"n": nom, "j": 0, "g": 0, "p": 0, "e": 0}
                                o[cl]["j"] = o[cl]["j"] + 1
                                if "winner" in pt["gameState"].keys():
                                    if pt["gameState"]["winner"] == "player1":
                                        o[cl]["g"] = o[cl]["g"] + 1
                                    else:
                                        if pt["gameState"]["winner"] == "ai":
                                            o[cl]["p"] = o[cl]["p"] + 1
                                        else:
                                            if pt["gameState"]["winner"] == "draw":
                                                o[cl]["e"] = o[cl]["e"] + 1
                    i = i + 1
                aux2 = list(o.values())
                i = 0
                while i < len(aux2):
                    if aux2[i]["j"] == 0:
                        aux2[i]["pv"] = 0
                    else:
                        aux2[i]["pv"] = round(aux2[i]["g"] / aux2[i]["j"] * 1000) / 10
                    i = i + 1
                aux2.sort(key=lambda x: (-x["g"], -x["pv"], x["n"]))
                aux2 = aux2[:int(str(limite))]
                lis = []
                i = 0
                while i < len(aux2):
                    lis.append({"puesto": i + 1, "jugador": aux2[i]["n"], "jugadas": aux2[i]["j"], "ganadas": aux2[i]["g"], "perdidas": aux2[i]["p"], "empatadas": aux2[i]["e"], "porcentajeVictorias": aux2[i]["pv"]})
                    i = i + 1
                tj = "todos"
                if tipoJuego != None and tipoJuego != "":
                    tj = tipoJuego
                df = "todas"
                if dificultad != None and dificultad != "":
                    df = dificultad
                res = {"filtros": {"tipoJuego": tj, "dificultad": df}, "totalPartidasTerminadas": n, "ranking": lis}
                if n == 0:
                    res["mensaje"] = "Todavía no hay partidas terminadas. Jugá una partida en la web."
                return json.dumps(res, indent=2, ensure_ascii=False)
            else:
                raise ToolError("No se encontró la base de datos de partidas en " + rb + ". Levantá la web y jugá una partida para crearla.")
        else:
            raise ToolError("Dificultad inválida: " + str(dificultad))
    else:
        raise ToolError("tipoJuego inválido: " + str(tipoJuego))


@s.tool(description="Victorias, derrotas y empates de un jugador por juego y por dificultad, racha actual y últimos 5 resultados. El nombre se busca sin importar mayúsculas ni espacios")
def obtener_estadisticas_jugador(nombreJugador):
    if nombreJugador != None and str(nombreJugador).strip() != "":
        if os.path.exists(rb):
            cx = sqlite3.connect(Path(rb).resolve().as_uri() + "?mode=ro", uri=True)
            d = []
            try:
                fl = cx.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM rps_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM connect_four_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            cx.close()
            d.sort(key=lambda x: x["gameState"]["updatedAt"])
            cl = str(nombreJugador).strip().lower()
            nom = ""
            tot = {"j": 0, "g": 0, "p": 0, "e": 0}
            pj = {}
            pd = {}
            lis = []
            ec = 0
            i = 0
            while i < len(d):
                pt = d[i]
                aux = "Player"
                for jg in pt["gameState"]["players"]:
                    if jg["isAI"] == False:
                        aux = jg["name"]
                aux = aux.strip()
                if aux.lower() == cl:
                    if pt["gameState"]["status"] == "finished":
                        if nom == "":
                            nom = aux
                        dif = "medium"
                        if "difficulty" in pt.keys():
                            if pt["difficulty"] != None and pt["difficulty"] != "":
                                dif = pt["difficulty"]
                        tot["j"] = tot["j"] + 1
                        ex = False
                        for c in pj.keys():
                            if c == pt["gameType"]:
                                ex = True
                        if ex == False:
                            pj[pt["gameType"]] = {"j": 0, "g": 0, "p": 0, "e": 0}
                        pj[pt["gameType"]]["j"] = pj[pt["gameType"]]["j"] + 1
                        ex = False
                        for c in pd.keys():
                            if c == dif:
                                ex = True
                        if ex == False:
                            pd[dif] = {"j": 0, "g": 0, "p": 0, "e": 0}
                        pd[dif]["j"] = pd[dif]["j"] + 1
                        rs = ""
                        if "winner" in pt["gameState"].keys():
                            if pt["gameState"]["winner"] == "player1":
                                tot["g"] = tot["g"] + 1
                                pj[pt["gameType"]]["g"] = pj[pt["gameType"]]["g"] + 1
                                pd[dif]["g"] = pd[dif]["g"] + 1
                                rs = "victoria"
                            else:
                                if pt["gameState"]["winner"] == "ai":
                                    tot["p"] = tot["p"] + 1
                                    pj[pt["gameType"]]["p"] = pj[pt["gameType"]]["p"] + 1
                                    pd[dif]["p"] = pd[dif]["p"] + 1
                                    rs = "derrota"
                                else:
                                    if pt["gameState"]["winner"] == "draw":
                                        tot["e"] = tot["e"] + 1
                                        pj[pt["gameType"]]["e"] = pj[pt["gameType"]]["e"] + 1
                                        pd[dif]["e"] = pd[dif]["e"] + 1
                                        rs = "empate"
                        lis.append({"idPartida": pt["gameState"]["id"], "tipoJuego": pt["gameType"], "dificultad": dif, "resultado": rs, "terminadaEn": pt["gameState"]["updatedAt"]})
                    else:
                        ec = ec + 1
                i = i + 1
            if tot["j"] > 0:
                pj2 = {}
                ks = list(pj.keys())
                i = 0
                while i < len(ks):
                    pj2[ks[i]] = {"jugadas": pj[ks[i]]["j"], "ganadas": pj[ks[i]]["g"], "perdidas": pj[ks[i]]["p"], "empatadas": pj[ks[i]]["e"], "porcentajeVictorias": round(pj[ks[i]]["g"] / pj[ks[i]]["j"] * 1000) / 10}
                    i = i + 1
                pd2 = {}
                ks = list(pd.keys())
                i = 0
                while i < len(ks):
                    pd2[ks[i]] = {"jugadas": pd[ks[i]]["j"], "ganadas": pd[ks[i]]["g"], "perdidas": pd[ks[i]]["p"], "empatadas": pd[ks[i]]["e"], "porcentajeVictorias": round(pd[ks[i]]["g"] / pd[ks[i]]["j"] * 1000) / 10}
                    i = i + 1
                lis.reverse()
                rch = None
                i = 0
                while i < len(lis):
                    if rch == None:
                        rch = {"resultado": lis[i]["resultado"], "cantidad": 1}
                    else:
                        if lis[i]["resultado"] == rch["resultado"]:
                            rch["cantidad"] = rch["cantidad"] + 1
                        else:
                            break
                    i = i + 1
                res = {"jugador": nom, "totales": {"jugadas": tot["j"], "ganadas": tot["g"], "perdidas": tot["p"], "empatadas": tot["e"], "porcentajeVictorias": round(tot["g"] / tot["j"] * 1000) / 10}, "porJuego": pj2, "porDificultad": pd2, "rachaActual": rch, "ultimosResultados": lis[:5], "enCurso": ec}
                return json.dumps(res, indent=2, ensure_ascii=False)
            else:
                raise ToolError('No se encontraron partidas terminadas del jugador "' + str(nombreJugador) + '"')
        else:
            raise ToolError("No se encontró la base de datos de partidas en " + rb + ". Levantá la web y jugá una partida para crearla.")
    else:
        raise ToolError("nombreJugador es obligatorio")


@s.tool(description="Cuántas veces gana, pierde y empata la IA en cada dificultad (solo partidas terminadas). Filtro opcional: tipoJuego (tic-tac-toe, rock-paper-scissors, connect-four)")
def obtener_rendimiento_ia(tipoJuego=None):
    if tipoJuego == None or tipoJuego == "" or tipoJuego == "tic-tac-toe" or tipoJuego == "rock-paper-scissors" or tipoJuego == "connect-four":
        if os.path.exists(rb):
            cx = sqlite3.connect(Path(rb).resolve().as_uri() + "?mode=ro", uri=True)
            d = []
            try:
                fl = cx.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM rps_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM connect_four_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            cx.close()
            o = {}
            n = 0
            i = 0
            while i < len(d):
                pt = d[i]
                if pt["gameState"]["status"] == "finished":
                    if tipoJuego == None or tipoJuego == "" or pt["gameType"] == tipoJuego:
                        n = n + 1
                        dif = "medium"
                        if "difficulty" in pt.keys():
                            if pt["difficulty"] != None and pt["difficulty"] != "":
                                dif = pt["difficulty"]
                        ex = False
                        for c in o.keys():
                            if c == dif:
                                ex = True
                        if ex == False:
                            o[dif] = {"j": 0, "vi": 0, "di": 0, "e": 0}
                        o[dif]["j"] = o[dif]["j"] + 1
                        if "winner" in pt["gameState"].keys():
                            if pt["gameState"]["winner"] == "ai":
                                o[dif]["vi"] = o[dif]["vi"] + 1
                            else:
                                if pt["gameState"]["winner"] == "player1":
                                    o[dif]["di"] = o[dif]["di"] + 1
                                else:
                                    if pt["gameState"]["winner"] == "draw":
                                        o[dif]["e"] = o[dif]["e"] + 1
                i = i + 1
            lis = []
            niv = ["easy", "medium", "hard"]
            i = 0
            while i < len(niv):
                ex = False
                for c in o.keys():
                    if c == niv[i]:
                        ex = True
                if ex == True:
                    lis.append({"dificultad": niv[i], "jugadas": o[niv[i]]["j"], "victoriasIA": o[niv[i]]["vi"], "derrotasIA": o[niv[i]]["di"], "empates": o[niv[i]]["e"], "porcentajeVictoriasIA": round(o[niv[i]]["vi"] / o[niv[i]]["j"] * 1000) / 10})
                i = i + 1
            tj = "todos"
            if tipoJuego != None and tipoJuego != "":
                tj = tipoJuego
            res = {"filtros": {"tipoJuego": tj}, "porDificultad": lis}
            if n == 0:
                res["mensaje"] = "Todavía no hay partidas terminadas. Jugá una partida en la web."
            return json.dumps(res, indent=2, ensure_ascii=False)
        else:
            raise ToolError("No se encontró la base de datos de partidas en " + rb + ". Levantá la web y jugá una partida para crearla.")
    else:
        raise ToolError("tipoJuego inválido: " + str(tipoJuego))


@s.tool(description="Últimas partidas terminadas, de la más nueva a la más vieja. Filtros opcionales: limite (por defecto 10), tipoJuego (tic-tac-toe, rock-paper-scissors, connect-four), nombreJugador")
def obtener_partidas_recientes(limite=10, tipoJuego=None, nombreJugador=None):
    if tipoJuego == None or tipoJuego == "" or tipoJuego == "tic-tac-toe" or tipoJuego == "rock-paper-scissors" or tipoJuego == "connect-four":
        if os.path.exists(rb):
            cx = sqlite3.connect(Path(rb).resolve().as_uri() + "?mode=ro", uri=True)
            d = []
            try:
                fl = cx.execute("SELECT game_session FROM tic_tac_toe_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM rps_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            try:
                fl = cx.execute("SELECT game_session FROM connect_four_games").fetchall()
                i = 0
                while i < len(fl):
                    d.append(json.loads(fl[i][0]))
                    i = i + 1
            except Exception:
                pass
            cx.close()
            d.sort(key=lambda x: x["gameState"]["updatedAt"], reverse=True)
            lis = []
            i = 0
            while i < len(d):
                pt = d[i]
                if pt["gameState"]["status"] == "finished":
                    if tipoJuego == None or tipoJuego == "" or pt["gameType"] == tipoJuego:
                        nom = "Player"
                        for jg in pt["gameState"]["players"]:
                            if jg["isAI"] == False:
                                nom = jg["name"]
                        nom = nom.strip()
                        if nombreJugador == None or str(nombreJugador).strip() == "" or nom.lower() == str(nombreJugador).strip().lower():
                            rs = "empate"
                            if "winner" in pt["gameState"].keys():
                                if pt["gameState"]["winner"] == "player1":
                                    rs = "victoria"
                                else:
                                    if pt["gameState"]["winner"] == "ai":
                                        rs = "derrota"
                            mrc = None
                            if pt["gameType"] == "rock-paper-scissors":
                                if "scores" in pt["gameState"].keys():
                                    if pt["gameState"]["scores"] != None:
                                        a1 = 0
                                        a2 = 0
                                        if "player1" in pt["gameState"]["scores"].keys():
                                            a1 = pt["gameState"]["scores"]["player1"]
                                        if "ai" in pt["gameState"]["scores"].keys():
                                            a2 = pt["gameState"]["scores"]["ai"]
                                        mrc = str(a1) + "-" + str(a2)
                            dif = "medium"
                            if "difficulty" in pt.keys():
                                if pt["difficulty"] != None and pt["difficulty"] != "":
                                    dif = pt["difficulty"]
                            lis.append({"idPartida": pt["gameState"]["id"], "tipoJuego": pt["gameType"], "jugador": nom, "dificultad": dif, "resultado": rs, "marcador": mrc, "terminadaEn": pt["gameState"]["updatedAt"]})
                            if len(lis) >= int(str(limite)):
                                break
                i = i + 1
            res = {"partidas": lis}
            if len(lis) == 0:
                res["mensaje"] = "No se encontraron partidas terminadas"
            return json.dumps(res, indent=2, ensure_ascii=False)
        else:
            raise ToolError("No se encontró la base de datos de partidas en " + rb + ". Levantá la web y jugá una partida para crearla.")
    else:
        raise ToolError("tipoJuego inválido: " + str(tipoJuego))


if __name__ == "__main__":
    s.run()
