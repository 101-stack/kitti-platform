// ─── Card Types ────────────────────────────────────────────────────────────────

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  id: number;
  suit: Suit;
  value: number;
  displayValue: string;
  display: string;
}

// ─── Player Types ──────────────────────────────────────────────────────────────

export interface Player {
  userId: string;
  username: string;
  isReady: boolean;
  isConnected: boolean;
  hasSubmitted?: boolean;
  submittedAt?: number | null;
  coins?: number;
}

export interface GamePlayer extends Player {
  hasSubmitted: boolean;
  submittedAt: number | null;
  sets?: Card[][];
}

// ─── Room Types ────────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';

export interface RoomOptions {
  enable235Rule: boolean;
}

export interface Room {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  entryFee: number;
  options: RoomOptions;
  players: Player[];
  createdAt: number;
  currentGameId?: string | null;
}

// ─── Game Types ────────────────────────────────────────────────────────────────

export type GameStatus = 'dealing' | 'submitting' | 'evaluating' | 'complete' | 'cancelled';

export interface GameState {
  gameId: string;
  roomId: string;
  status: GameStatus;
  players: GamePlayer[];
  options: RoomOptions;
  entryFee: number;
  totalPot: number;
  startedAt: number;
  submitDeadline: number;
  rounds: any[];
  result?: GameResult;
}

// ─── Hand Evaluation Types ─────────────────────────────────────────────────────

export type HandName = 'Trail' | 'Pure Sequence' | 'Sequence' | 'Flush' | 'Pair' | 'High Card';

export interface HandRanking {
  rank: number;
  userId: string;
  username: string;
  hand: string;
  handName: HandName;
  handRank: number;
  tiebreakers: number[];
}

export interface SetResult {
  setIndex: number;
  rankings: HandRanking[];
  winner: string | null;
  isTie: boolean;
}

export interface GameResult {
  gameId: string;
  overallWinner: string | null;
  isTie: boolean;
  isSalami?: boolean;
  setResults: SetResult[];
  pointsMap: Record<string, number>;
  totalPot: number;
  playerSets: {
    userId: string;
    username: string;
    sets: Card[][];
  }[];
}

// ─── Socket Event Payloads ─────────────────────────────────────────────────────

export interface DealCardsPayload {
  gameId: string;
  cards: Card[];
  submitDeadline: number;
}

export interface GameStartedPayload {
  gameId: string;
  players: GamePlayer[];
  submitDeadline: number;
}

export interface PlayerSubmittedPayload {
  userId: string;
  username: string;
  submittedAt: number;
  playersSubmitted: number;
  totalPlayers: number;
}

export interface PlayerJoinedPayload {
  userId: string;
  username: string;
  roomState: Room;
}

// ─── UI State ──────────────────────────────────────────────────────────────────

// A "slot" in the set builder: one of 3 positions in one of 3 sets
export type SetIndex = 0 | 1 | 2;
export type SlotIndex = 0 | 1 | 2;

export interface CardAssignment {
  setIndex: SetIndex;
  slotIndex: SlotIndex;
}

// Map from card.id → { setIndex, slotIndex }
export type CardPlacement = Record<number, CardAssignment>;

// ─── API Types ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  coins: number;
  totalGames: number;
  totalWins: number;
  totalEarnings: number;
  isVerified: boolean;
  avatarUrl?: string;
  is_admin?: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalWins: number;
  totalGames: number;
  winRate: number;
  totalEarnings: number;
  coins: number;
}

export interface MatchSummary {
  id: string;
  roomId: string;
  winnerId?: string;
  totalPot: number;
  isTie: boolean;
  startedAt: string;
  completedAt?: string;
}
