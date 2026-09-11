import { vi } from 'vitest'

vi.mock('../../../../../lib/game-storage', () => ({
  getAllConnectFourGames: vi.fn()
}));

import * as gameStorage from '../../../../../lib/game-storage';
import { GET } from './route';

const mockGameStorage = vi.mocked(gameStorage);

describe('/api/games/connect-four/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return every connect four game for the MCP server', async () => {
    mockGameStorage.getAllConnectFourGames.mockResolvedValue([
      { gameState: { id: 'c4-1' }, gameType: 'connect-four', history: [] }
    ] as never);

    const response = await GET();
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData[0].gameState.id).toBe('c4-1');
  });

  it('should return 500 when games cannot be loaded', async () => {
    mockGameStorage.getAllConnectFourGames.mockRejectedValue(new Error('DB down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to fetch games' });
  });
});
