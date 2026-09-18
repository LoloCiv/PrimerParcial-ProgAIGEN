"""Servidor MCP de estadísticas de partidas (solo lectura sobre web/games.db)."""

import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Final, Optional

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

Partida = dict[str, Any]
Contador = dict[str, Any]

RUTA_BASE_DATOS: Final[str] = os.environ.get("GAMES_DB_PATH") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "web", "games.db"
)

TIPOS_JUEGO: Final[tuple[str, ...]] = ("tic-tac-toe", "rock-paper-scissors", "connect-four")
TIPO_PIEDRA_PAPEL_TIJERA: Final[str] = "rock-paper-scissors"
DIFICULTADES: Final[tuple[str, ...]] = ("easy", "medium", "hard")
DIFICULTAD_POR_DEFECTO: Final[str] = "medium"
TABLAS: Final[tuple[str, ...]] = ("tic_tac_toe_games", "rps_games", "connect_four_games")

ESTADO_TERMINADA: Final[str] = "finished"
GANADOR_JUGADOR: Final[str] = "player1"
GANADOR_IA: Final[str] = "ai"
GANADOR_EMPATE: Final[str] = "draw"
NOMBRE_POR_DEFECTO: Final[str] = "Player"

MENSAJE_SIN_PARTIDAS: Final[str] = (
    "Todavía no hay partidas terminadas. Jugá una partida en la web."
)

servidor = MCPServer("game-stats")


# --- Validaciones -----------------------------------------------------------


def _sin_filtro(valor: Optional[str]) -> bool:
    """Indica si un filtro opcional vino vacío."""
    return valor is None or valor == ""


def _validar_tipo_juego(tipo_juego: Optional[str]) -> None:
    """Lanza ToolError si el tipo de juego no es válido."""
    if tipo_juego not in (None, "", *TIPOS_JUEGO):
        raise ToolError("tipoJuego inválido: " + str(tipo_juego))


def _validar_dificultad(dificultad: Optional[str]) -> None:
    """Lanza ToolError si la dificultad no es válida."""
    if dificultad not in (None, "", *DIFICULTADES):
        raise ToolError("Dificultad inválida: " + str(dificultad))


def _verificar_base_datos() -> None:
    """Lanza ToolError si no existe el archivo de la base de datos."""
    if not os.path.exists(RUTA_BASE_DATOS):
        raise ToolError(
            "No se encontró la base de datos de partidas en " + RUTA_BASE_DATOS
            + ". Levantá la web y jugá una partida para crearla."
        )


# --- Acceso a datos ---------------------------------------------------------


def _cargar_partidas() -> list[Partida]:
    """Lee todas las partidas de las tablas de juegos en modo solo lectura."""
    _verificar_base_datos()
    uri = Path(RUTA_BASE_DATOS).resolve().as_uri() + "?mode=ro"
    partidas: list[Partida] = []
    with closing(sqlite3.connect(uri, uri=True)) as conexion:
        for tabla in TABLAS:
            try:
                filas = conexion.execute(f"SELECT game_session FROM {tabla}").fetchall()
                for (sesion,) in filas:
                    partidas.append(json.loads(sesion))
            except Exception:
                pass
    return partidas


def _ordenar_por_fecha(partidas: list[Partida], descendente: bool = False) -> None:
    """Ordena las partidas por fecha de actualización (in place, estable)."""
    partidas.sort(key=lambda partida: partida["gameState"]["updatedAt"], reverse=descendente)


# --- Lectura de una partida -------------------------------------------------


def _esta_terminada(partida: Partida) -> bool:
    """Indica si la partida terminó."""
    return partida["gameState"]["status"] == ESTADO_TERMINADA


def _coincide_tipo(partida: Partida, tipo_juego: Optional[str]) -> bool:
    """Indica si la partida pasa el filtro de tipo de juego."""
    return _sin_filtro(tipo_juego) or partida["gameType"] == tipo_juego


def _nombre_jugador(partida: Partida) -> str:
    """Devuelve el nombre del último jugador humano de la partida, sin espacios."""
    nombre = NOMBRE_POR_DEFECTO
    for jugador in partida["gameState"]["players"]:
        if not jugador["isAI"]:
            nombre = jugador["name"]
    return nombre.strip()


def _dificultad(partida: Partida) -> str:
    """Devuelve la dificultad de la partida o la dificultad por defecto."""
    dificultad = partida.get("difficulty")
    if dificultad is None or dificultad == "":
        return DIFICULTAD_POR_DEFECTO
    return dificultad


def _ganador(partida: Partida) -> Optional[str]:
    """Devuelve el ganador de la partida, si lo hay."""
    return partida["gameState"].get("winner")


def _resultado_para_humano(ganador: Optional[str]) -> str:
    """Traduce el ganador al resultado visto desde el jugador humano."""
    resultados = {
        GANADOR_JUGADOR: "victoria",
        GANADOR_IA: "derrota",
        GANADOR_EMPATE: "empate",
    }
    return resultados.get(ganador, "")


def _marcador(partida: Partida) -> Optional[str]:
    """Devuelve el marcador 'jugador-IA' de piedra, papel o tijera."""
    if partida["gameType"] != TIPO_PIEDRA_PAPEL_TIJERA:
        return None
    puntajes = partida["gameState"].get("scores")
    if puntajes is None:
        return None
    return str(puntajes.get(GANADOR_JUGADOR, 0)) + "-" + str(puntajes.get(GANADOR_IA, 0))


# --- Conteo de resultados ---------------------------------------------------


def _nuevo_contador() -> Contador:
    """Crea un contador de resultados vacío."""
    return {"jugadas": 0, "ganadas": 0, "perdidas": 0, "empatadas": 0}


def _registrar_resultado(contador: Contador, ganador: Optional[str]) -> None:
    """Suma una partida jugada y su resultado (desde el jugador humano)."""
    contador["jugadas"] += 1
    if ganador == GANADOR_JUGADOR:
        contador["ganadas"] += 1
    elif ganador == GANADOR_IA:
        contador["perdidas"] += 1
    elif ganador == GANADOR_EMPATE:
        contador["empatadas"] += 1


def _porcentaje(ganadas: int, jugadas: int) -> float:
    """Porcentaje de victorias con un decimal."""
    if jugadas == 0:
        return 0
    return round(ganadas / jugadas * 1000) / 10


def _resumen_contador(contador: Contador) -> dict[str, Any]:
    """Convierte un contador en el formato de salida de las tools."""
    return {
        "jugadas": contador["jugadas"],
        "ganadas": contador["ganadas"],
        "perdidas": contador["perdidas"],
        "empatadas": contador["empatadas"],
        "porcentajeVictorias": _porcentaje(contador["ganadas"], contador["jugadas"]),
    }


def _racha_actual(resultados: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Cuenta cuántos resultados iguales seguidos hay al principio de la lista."""
    if not resultados:
        return None
    racha = {"resultado": resultados[0]["resultado"], "cantidad": 0}
    for resultado in resultados:
        if resultado["resultado"] != racha["resultado"]:
            break
        racha["cantidad"] += 1
    return racha


def _json(respuesta: dict[str, Any]) -> str:
    """Serializa la respuesta de una tool."""
    return json.dumps(respuesta, indent=2, ensure_ascii=False)


# --- Tools ------------------------------------------------------------------


@servidor.tool(
    description=(
        "Ranking de jugadores por victorias y porcentaje de victorias (solo partidas "
        "terminadas). Filtros opcionales: tipoJuego (tic-tac-toe, rock-paper-scissors, "
        "connect-four), dificultad (easy, medium, hard), limite (por defecto 10)"
    )
)
def obtener_ranking(
    tipoJuego: Optional[str] = None,  # noqa: N803
    dificultad: Optional[str] = None,
    limite: int = 10,
) -> str:
    """Ranking de jugadores por victorias y porcentaje de victorias."""
    _validar_tipo_juego(tipoJuego)
    _validar_dificultad(dificultad)
    partidas = _cargar_partidas()
    _ordenar_por_fecha(partidas)

    estadisticas_por_jugador: dict[str, Contador] = {}
    total_terminadas = 0
    for partida in partidas:
        if not _esta_terminada(partida) or not _coincide_tipo(partida, tipoJuego):
            continue
        if not _sin_filtro(dificultad) and _dificultad(partida) != dificultad:
            continue
        total_terminadas += 1
        nombre = _nombre_jugador(partida)
        estadisticas = estadisticas_por_jugador.setdefault(
            nombre.lower(), {"nombre": nombre, **_nuevo_contador()}
        )
        _registrar_resultado(estadisticas, _ganador(partida))

    filas_ranking = [
        {**fila, "porcentaje": _porcentaje(fila["ganadas"], fila["jugadas"])}
        for fila in estadisticas_por_jugador.values()
    ]
    filas_ranking.sort(key=lambda fila: (-fila["ganadas"], -fila["porcentaje"], fila["nombre"]))
    ranking = [
        {
            "puesto": puesto,
            "jugador": fila["nombre"],
            "jugadas": fila["jugadas"],
            "ganadas": fila["ganadas"],
            "perdidas": fila["perdidas"],
            "empatadas": fila["empatadas"],
            "porcentajeVictorias": fila["porcentaje"],
        }
        for puesto, fila in enumerate(filas_ranking[:limite], start=1)
    ]

    respuesta: dict[str, Any] = {
        "filtros": {
            "tipoJuego": "todos" if _sin_filtro(tipoJuego) else tipoJuego,
            "dificultad": "todas" if _sin_filtro(dificultad) else dificultad,
        },
        "totalPartidasTerminadas": total_terminadas,
        "ranking": ranking,
    }
    if total_terminadas == 0:
        respuesta["mensaje"] = MENSAJE_SIN_PARTIDAS
    return _json(respuesta)


@servidor.tool(
    description=(
        "Victorias, derrotas y empates de un jugador por juego y por dificultad, racha "
        "actual y últimos 5 resultados. El nombre se busca sin importar mayúsculas ni espacios"
    )
)
def obtener_estadisticas_jugador(nombreJugador: Optional[str]) -> str:  # noqa: N803
    """Estadísticas de un jugador: totales, por juego, por dificultad y racha."""
    if nombreJugador is None or str(nombreJugador).strip() == "":
        raise ToolError("nombreJugador es obligatorio")
    partidas = _cargar_partidas()
    _ordenar_por_fecha(partidas)

    nombre_buscado = str(nombreJugador).strip().lower()
    nombre_mostrado = ""
    totales = _nuevo_contador()
    por_juego: dict[str, Contador] = {}
    por_dificultad: dict[str, Contador] = {}
    resultados: list[dict[str, Any]] = []
    en_curso = 0
    for partida in partidas:
        nombre = _nombre_jugador(partida)
        if nombre.lower() != nombre_buscado:
            continue
        if not _esta_terminada(partida):
            en_curso += 1
            continue
        if nombre_mostrado == "":
            nombre_mostrado = nombre
        dificultad = _dificultad(partida)
        ganador = _ganador(partida)
        for contador in (
            totales,
            por_juego.setdefault(partida["gameType"], _nuevo_contador()),
            por_dificultad.setdefault(dificultad, _nuevo_contador()),
        ):
            _registrar_resultado(contador, ganador)
        resultados.append({
            "idPartida": partida["gameState"]["id"],
            "tipoJuego": partida["gameType"],
            "dificultad": dificultad,
            "resultado": _resultado_para_humano(ganador),
            "terminadaEn": partida["gameState"]["updatedAt"],
        })

    if totales["jugadas"] == 0:
        raise ToolError(
            'No se encontraron partidas terminadas del jugador "' + str(nombreJugador) + '"'
        )

    resultados.reverse()
    respuesta = {
        "jugador": nombre_mostrado,
        "totales": _resumen_contador(totales),
        "porJuego": {juego: _resumen_contador(c) for juego, c in por_juego.items()},
        "porDificultad": {dif: _resumen_contador(c) for dif, c in por_dificultad.items()},
        "rachaActual": _racha_actual(resultados),
        "ultimosResultados": resultados[:5],
        "enCurso": en_curso,
    }
    return _json(respuesta)


@servidor.tool(
    description=(
        "Cuántas veces gana, pierde y empata la IA en cada dificultad (solo partidas "
        "terminadas). Filtro opcional: tipoJuego (tic-tac-toe, rock-paper-scissors, connect-four)"
    )
)
def obtener_rendimiento_ia(tipoJuego: Optional[str] = None) -> str:  # noqa: N803
    """Victorias, derrotas y empates de la IA agrupados por dificultad."""
    _validar_tipo_juego(tipoJuego)
    partidas = _cargar_partidas()

    por_dificultad: dict[str, Contador] = {}
    total_terminadas = 0
    for partida in partidas:
        if not _esta_terminada(partida) or not _coincide_tipo(partida, tipoJuego):
            continue
        total_terminadas += 1
        contador = por_dificultad.setdefault(_dificultad(partida), _nuevo_contador())
        _registrar_resultado(contador, _ganador(partida))

    # El contador está desde el humano: una derrota del humano es una victoria de la IA.
    rendimiento = [
        {
            "dificultad": dificultad,
            "jugadas": contador["jugadas"],
            "victoriasIA": contador["perdidas"],
            "derrotasIA": contador["ganadas"],
            "empates": contador["empatadas"],
            "porcentajeVictoriasIA": _porcentaje(contador["perdidas"], contador["jugadas"]),
        }
        for dificultad in DIFICULTADES
        if (contador := por_dificultad.get(dificultad)) is not None
    ]

    respuesta: dict[str, Any] = {
        "filtros": {"tipoJuego": "todos" if _sin_filtro(tipoJuego) else tipoJuego},
        "porDificultad": rendimiento,
    }
    if total_terminadas == 0:
        respuesta["mensaje"] = MENSAJE_SIN_PARTIDAS
    return _json(respuesta)


@servidor.tool(
    description=(
        "Últimas partidas terminadas, de la más nueva a la más vieja. Filtros opcionales: "
        "limite (por defecto 10), tipoJuego (tic-tac-toe, rock-paper-scissors, connect-four), "
        "nombreJugador"
    )
)
def obtener_partidas_recientes(
    limite: int = 10,
    tipoJuego: Optional[str] = None,  # noqa: N803
    nombreJugador: Optional[str] = None,  # noqa: N803
) -> str:
    """Últimas partidas terminadas, de la más nueva a la más vieja."""
    _validar_tipo_juego(tipoJuego)
    partidas = _cargar_partidas()
    _ordenar_por_fecha(partidas, descendente=True)

    nombre_buscado = "" if nombreJugador is None else str(nombreJugador).strip().lower()
    recientes: list[dict[str, Any]] = []
    for partida in partidas:
        if not _esta_terminada(partida) or not _coincide_tipo(partida, tipoJuego):
            continue
        nombre = _nombre_jugador(partida)
        if nombre_buscado and nombre.lower() != nombre_buscado:
            continue
        recientes.append({
            "idPartida": partida["gameState"]["id"],
            "tipoJuego": partida["gameType"],
            "jugador": nombre,
            "dificultad": _dificultad(partida),
            "resultado": _resultado_para_humano(_ganador(partida)) or "empate",
            "marcador": _marcador(partida),
            "terminadaEn": partida["gameState"]["updatedAt"],
        })
        if len(recientes) >= limite:
            break

    respuesta: dict[str, Any] = {"partidas": recientes}
    if not recientes:
        respuesta["mensaje"] = "No se encontraron partidas terminadas"
    return _json(respuesta)


if __name__ == "__main__":
    servidor.run()
