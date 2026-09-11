import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectFourBoard } from './ConnectFourBoard';
import type { ConnectFourGameState } from '@turn-based-mcp/shared';

const emptyBoard = () => Array.from({ length: 6 }, () => Array(7).fill(null));

const createMockGameState = (overrides: Partial<ConnectFourGameState> = {}): ConnectFourGameState => ({
  id: 'test-c4',
  players: [
    { id: 'player1', name: 'Player', isAI: false },
    { id: 'ai', name: 'AI', isAI: true }
  ],
  currentPlayerId: 'player1',
  status: 'playing',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:05:00Z'),
  board: emptyBoard(),
  playerDiscs: { player1: 'R', ai: 'Y' },
  ...overrides
});

describe('ConnectFourBoard', () => {
  const mockOnMove = vi.fn();

  beforeEach(() => {
    mockOnMove.mockClear();
  });

  it('should render 7 droppable columns', () => {
    render(<ConnectFourBoard gameState={createMockGameState()} onMove={mockOnMove} />);

    expect(screen.getAllByRole('button', { name: /Drop disc in column/ })).toHaveLength(7);
  });

  it('should render the discs on the board', () => {
    const board = emptyBoard();
    board[5][3] = 'R';
    board[4][3] = 'Y';
    board[5][4] = 'R';

    render(<ConnectFourBoard gameState={createMockGameState({ board })} onMove={mockOnMove} />);

    expect(screen.getAllByLabelText('Red disc')).toHaveLength(2);
    expect(screen.getAllByLabelText('Yellow disc')).toHaveLength(1);
  });

  it('should call onMove with the clicked column', () => {
    render(<ConnectFourBoard gameState={createMockGameState()} onMove={mockOnMove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Drop disc in column 4' }));

    expect(mockOnMove).toHaveBeenCalledWith({ column: 3 });
  });

  it('should disable a full column', () => {
    const board = emptyBoard().map((row, rowIndex) => {
      row[0] = rowIndex % 2 === 0 ? 'R' : 'Y';
      return row;
    });

    render(<ConnectFourBoard gameState={createMockGameState({ board })} onMove={mockOnMove} />);
    const fullColumn = screen.getByRole('button', { name: 'Drop disc in column 1' });
    fireEvent.click(fullColumn);

    expect(fullColumn).toBeDisabled();
    expect(mockOnMove).not.toHaveBeenCalled();
  });

  it('should lock the board during the AI turn', () => {
    render(
      <ConnectFourBoard gameState={createMockGameState({ currentPlayerId: 'ai' })} onMove={mockOnMove} disabled />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Drop disc in column 4' }));

    expect(screen.getByText(/AI's Turn - Board Locked/)).toBeInTheDocument();
    expect(mockOnMove).not.toHaveBeenCalled();
  });

  it('should show whose turn it is with the disc colour', () => {
    render(<ConnectFourBoard gameState={createMockGameState()} onMove={mockOnMove} />);

    expect(screen.getByText('Your turn (Red)')).toBeInTheDocument();
  });

  it.each([
    ['player1', 'You won! 🎉'],
    ['ai', 'AI won! 🤖'],
    ['draw', "It's a draw! 🤝"]
  ] as const)('should announce the result when the winner is %s', (winner, message) => {
    render(
      <ConnectFourBoard gameState={createMockGameState({ status: 'finished', winner })} onMove={mockOnMove} />
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
