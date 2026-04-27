import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UserProfile, Room, GameState, Card, GameResult,
  CardPlacement, SetIndex, SlotIndex
} from '@/types/game';

// ─── Auth Store ────────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
  updateCoins: (coins: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
      updateCoins: (coins) =>
        set((state) => ({
          user: state.user ? { ...state.user, coins } : null,
        })),
    }),
    {
      name: 'kitti-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// ─── Room Store ────────────────────────────────────────────────────────────────

interface RoomState {
  room: Room | null;
  setRoom: (room: Room | null) => void;
  updateRoom: (partial: Partial<Room>) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  updateRoom: (partial) =>
    set((state) => ({
      room: state.room ? { ...state.room, ...partial } : null,
    })),
}));

// ─── Game Store ────────────────────────────────────────────────────────────────

interface GameState_ {
  gameId: string | null;
  gameState: GameState | null;
  myCards: Card[];
  submitDeadline: number | null;
  cardPlacement: CardPlacement;
  selectedCard: Card | null;
  gameResult: GameResult | null;
  isSubmitting: boolean;
  hasSubmitted: boolean;

  setGameId: (id: string | null) => void;
  setGameState: (state: GameState | null) => void;
  setMyCards: (cards: Card[]) => void;
  setSubmitDeadline: (deadline: number | null) => void;
  placeCard: (cardId: number, setIndex: SetIndex, slotIndex: SlotIndex) => void;
  removeCardPlacement: (cardId: number) => void;
  setSelectedCard: (card: Card | null) => void;
  setGameResult: (result: GameResult | null) => void;
  setIsSubmitting: (v: boolean) => void;
  setHasSubmitted: (v: boolean) => void;
  resetGame: () => void;

  // Derived: build sets array from placement
  buildSets: () => Card[][] | null;
}

const initialGameState = {
  gameId: null,
  gameState: null,
  myCards: [],
  submitDeadline: null,
  cardPlacement: {},
  selectedCard: null,
  gameResult: null,
  isSubmitting: false,
  hasSubmitted: false,
};

export const useGameStore = create<GameState_>((set, get) => ({
  ...initialGameState,

  setGameId: (gameId) => set({ gameId }),
  setGameState: (gameState) => set({ gameState }),
  setMyCards: (myCards) => set({ myCards }),
  setSubmitDeadline: (submitDeadline) => set({ submitDeadline }),
  setSelectedCard: (selectedCard) => set({ selectedCard }),
  setGameResult: (gameResult) => set({ gameResult }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  setHasSubmitted: (hasSubmitted) => set({ hasSubmitted }),

  placeCard: (cardId, setIndex, slotIndex) =>
    set((state) => {
      const placement = { ...state.cardPlacement };
      // Remove card from previous slot if it was placed
      for (const [id, pos] of Object.entries(placement)) {
        if (pos.setIndex === setIndex && pos.slotIndex === slotIndex) {
          delete placement[Number(id)];
        }
      }
      placement[cardId] = { setIndex, slotIndex };
      return { cardPlacement: placement };
    }),

  removeCardPlacement: (cardId) =>
    set((state) => {
      const placement = { ...state.cardPlacement };
      delete placement[cardId];
      return { cardPlacement: placement };
    }),

  buildSets: () => {
    const { myCards, cardPlacement } = get();
    if (Object.keys(cardPlacement).length !== 9) return null;

    const sets: Card[][] = [[], [], []];
    const cardMap = new Map(myCards.map((c) => [c.id, c]));

    for (const [cardIdStr, { setIndex, slotIndex }] of Object.entries(cardPlacement)) {
      const card = cardMap.get(Number(cardIdStr));
      if (!card) return null;
      sets[setIndex][slotIndex] = card;
    }

    // Validate all sets are fully filled
    for (const set of sets) {
      if (set.length !== 3 || set.some((c) => !c)) return null;
    }

    return sets;
  },

  resetGame: () => set({ ...initialGameState }),
}));
