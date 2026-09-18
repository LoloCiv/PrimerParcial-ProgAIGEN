# MCP en videojuegos

**Parcial 1 · Programación con IA Generativa**
Laureano Civetta · Ingeniería en Inteligencia Artificial

Juegos por turnos contra la IA usando **Model Context Protocol (MCP)**. Claude Code juega las partidas a través de un servidor MCP, y GitHub Copilot consulta el historial de resultados a través de un segundo servidor MCP.

## De qué se trata

El punto de partida es **turn-based-mcp**, un demo que encontré en [mcpmarket.com](https://mcpmarket.com), dentro de la categoría de videojuegos. Trae una web en Next.js con Ta-Te-Ti y Piedra, Papel o Tijera, y un servidor MCP en TypeScript que le permite a un agente jugar contra el usuario.

Sobre esa base hice tres cosas:

1. **Agregué el 4 en línea** a la web y al MCP de juegos, con una IA en tres dificultades. La difícil usa minimax con poda alfa-beta y mira 6 jugadas hacia adelante.
2. **Armé un segundo servidor MCP en Python** (`stats-mcp/`) que lee el historial de partidas y responde quién gana y quién pierde.
3. **Refactoricé ese servidor con Copilot** (modo Plan y modo Agent): partió de un código deliberadamente desprolijo y quedó modular, tipado y documentado, sin cambiar lo que devuelven las tools.

```
Claude Code ──► MCP de juegos (TypeScript, stdio) ──► API de la web (:3000) ──► web/games.db
GitHub Copilot ──► MCP de estadísticas (Python, stdio) ─────────── solo lectura ──┘
```

El MCP de juegos nunca toca la base: lee y guarda las partidas a través de la API de la web. El de estadísticas abre `web/games.db` directamente, en modo solo lectura.

## Requisitos

- **Node.js 24** (con Node 20 falla `better-sqlite3`) y npm
- **Python 3.12+** y [uv](https://docs.astral.sh/uv/)
- **Claude Code** para el MCP de juegos
- **VS Code con GitHub Copilot** para el MCP de estadísticas

## Instalación

```bash
npm install
npm run build --workspace=shared
npm run build --workspace=mcp-server
uv sync --directory stats-mcp
```

Levantar la web (queda en `http://localhost:3000`):

```bash
npm run dev
```

## Configuración de los MCP

Cada cliente lee su propio archivo de configuración. Los dos están incluidos en el repo.

### MCP de juegos en Claude Code · `.mcp.json`

Se generó con este comando, desde la raíz del proyecto:

```bash
claude mcp add --scope project turn-based-games -- node mcp-server/dist/server.js
```

Para verificar que está conectado: `claude mcp list` en la terminal, o `/mcp` dentro de la sesión de Claude. La web tiene que estar corriendo.

| Tool | Qué hace |
|------|----------|
| `create_game` | Crea una partida (`tic-tac-toe`, `rock-paper-scissors` o `connect-four`) |
| `play_game` | Calcula y juega el turno de la IA |
| `make_player_move` | Registra la jugada del humano dicha por el chat |
| `wait_for_player_move` | Espera a que el humano juegue desde la web |
| `analyze_game` | Describe el estado de una partida |

### MCP de estadísticas en Copilot · `.vscode/mcp.json`

Se agregó con `Ctrl+Shift+P` → **MCP: Add Server** → **Command (stdio)**, guardado en **Workspace**, con este comando:

```
uv run --directory ${workspaceFolder}/stats-mcp python server.py
```

Después se inicia con **Start** y se activa en el chat de Copilot (modo Agent → herramientas).

| Tool | Qué devuelve |
|------|--------------|
| `obtener_ranking` | Ranking por victorias y porcentaje. Filtros: `tipoJuego`, `dificultad`, `limite` |
| `obtener_estadisticas_jugador` | Totales por juego y dificultad, racha actual y últimos resultados |
| `obtener_rendimiento_ia` | Victorias, derrotas y empates de la IA en cada dificultad |
| `obtener_partidas_recientes` | Últimas partidas terminadas. Filtros: `limite`, `tipoJuego`, `nombreJugador` |

## Uso

1. Con la web levantada, pedirle a Claude una partida, por ejemplo: *"Creá una partida de 4 en línea en dificultad difícil, soy rojo, y jugá en loop con play_game y wait_for_player_move"*.
2. Entrar a la partida en la web con **Join by ID** y jugar. Al terminar, el resultado queda guardado en `web/games.db`.
3. Preguntarle a Copilot en modo Agent, por ejemplo: *"Usando game-stats, ¿cuáles son mis partidas recientes?"*.

`web/games.db` no se sube al repo, así que en una instalación nueva arranca vacía: hay que jugar al menos una partida antes de consultar estadísticas.

## Código inicial vs. código final

El historial de git muestra cada etapa:

| Commit | Qué contiene |
|--------|--------------|
| `5a7ee6f` | Repo original, sin modificaciones |
| `dd06896` | Se agrega el 4 en línea (juego, IA, tools del MCP, web y tests) |
| `fd07ac1` | `stats-mcp/server.py` en su versión inicial, antes del refactor |
| `0e52957` | Configuración de los MCP y `server.py` refactorizado |

Para comparar el servidor de estadísticas antes y después:

```bash
git diff fd07ac1 0e52957 -- stats-mcp/server.py
```

| Métrica de `server.py` | Antes | Después |
|------------------------|-------|---------|
| Niveles de anidamiento | 11 | 4 |
| Bucles `while` manuales | 22 | 0 |
| Consultas SQL copiadas | 12 | 1 |
| Líneas de la función más larga | 125 | 55 |
| Funciones | 4 | 23 |
| Funciones con type hints y docstring | 0 | 23 |

## Estructura

```
├── shared/        Lógica de los juegos, tipos y acceso a SQLite
├── web/           Web en Next.js y API de partidas (guarda en web/games.db)
├── mcp-server/    MCP de juegos en TypeScript (tools, IA de cada juego)
├── stats-mcp/     MCP de estadísticas en Python
├── .mcp.json      Configuración del MCP de juegos para Claude Code
└── .vscode/mcp.json  Configuración del MCP de estadísticas para Copilot
```

Tests del monorepo: `npm run test`.

## Créditos

Basado en *turn-based-mcp*, un demo de MCP con licencia MIT. El 4 en línea, el servidor `stats-mcp` y la configuración de los MCP son agregados de este parcial.
