import { BaseGameState } from './game';

// Tic-tac-toe specific types
export type CellValue = 'X' | 'O' | null;
export type Board = CellValue[][];

export interface TicTacToeMove {
  row: number;
  col: number;
}

export interface TicTacToeGameState extends BaseGameState {
  board: Board;
  playerSymbols: Record<string, 'X' | 'O'>;
}

// Rock Paper Scissors specific types
export type RPSChoice = 'rock' | 'paper' | 'scissors';

export interface RPSMove {
  choice: RPSChoice;
}

export interface RPSGameState extends BaseGameState {
  rounds: Array<{
    player1Choice?: RPSChoice;
    player2Choice?: RPSChoice;
    winner?: string | 'draw';
  }>;
  currentRound: number;
  maxRounds: number;
  scores: Record<string, number>;
}

// Connect Four specific types
export type ConnectFourDisc = 'R' | 'Y';
export type ConnectFourCell = ConnectFourDisc | null;
/** 6 rows x 7 columns, row 0 is the top of the board */
export type ConnectFourBoard = ConnectFourCell[][];

export interface ConnectFourMove {
  column: number;
}

export interface ConnectFourGameState extends BaseGameState {
  board: ConnectFourBoard;
  playerDiscs: Record<string, ConnectFourDisc>;
  lastMove?: { row: number; column: number };
}
