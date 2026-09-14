# MCP game-stats (Python)

Servidor MCP que abre la base de partidas (`web/games.db`) en **solo lectura** y responde quién va ganando y perdiendo contra la IA.
Es independiente del monorepo en TypeScript: solo lee el archivo SQLite que escribe la web.

## Requisitos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (o pip, ver más abajo)

## Tools

| Tool | Qué devuelve |
|------|--------------|
| `obtener_ranking` | Ranking por victorias y porcentaje de victorias. Filtros: `tipoJuego`, `dificultad`, `limite` |
| `obtener_estadisticas_jugador` | Totales por juego y por dificultad, racha actual y últimos 5 resultados de un jugador (`nombreJugador`) |
| `obtener_rendimiento_ia` | Victorias, derrotas y empates de la IA en cada dificultad. Filtro: `tipoJuego` |
| `obtener_partidas_recientes` | Últimas partidas terminadas, de la más nueva a la más vieja. Filtros: `limite`, `tipoJuego`, `nombreJugador` |

Solo cuentan las partidas terminadas. Los resultados se ven desde el jugador humano (`victoria` / `derrota` / `empate`) y los nombres se comparan sin importar mayúsculas ni espacios.

## Ejecutar

Desde la raíz del repo:

```bash
uv run --directory stats-mcp python server.py
```

El servidor habla MCP por stdio, así que normalmente lo arranca un cliente MCP. Ejemplo para VS Code (`.vscode/mcp.json`):

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

La base de datos por defecto es `../web/games.db` (relativa a esta carpeta). Se puede cambiar con la variable de entorno `GAMES_DB_PATH`.

### Sin uv

```bash
cd stats-mcp
python -m venv .venv
.venv\Scripts\activate
pip install "mcp>=2.2,<3"
python server.py
```

Las estadísticas salen de las partidas que se juegan en la web (`npm run dev` en la raíz del repo).
