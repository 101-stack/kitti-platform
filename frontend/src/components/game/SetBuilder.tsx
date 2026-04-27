'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from './PlayingCard';
import { useGameStore } from '@/store/gameStore';
import type { Card, SetIndex, SlotIndex } from '@/types/game';
import clsx from 'clsx';

const SET_NAMES = ['Set 1', 'Set 2', 'Set 3'];
const HAND_HINTS: Record<string, { color: string; label: string }> = {
  Trail: { color: '#f0c060', label: '🔱 Trail' },
  'Pure Sequence': { color: '#60d0f0', label: '🌊 Pure Seq' },
  Sequence: { color: '#90d060', label: '🎯 Sequence' },
  Flush: { color: '#d090f0', label: '💜 Flush' },
  Pair: { color: '#f09060', label: '🎰 Pair' },
  'High Card': { color: 'var(--text-muted)', label: '🃏 High Card' },
};

// Quick client-side hand evaluation for UI hints only
function quickEval(cards: (Card | null)[]): string | null {
  const filled = cards.filter(Boolean) as Card[];
  if (filled.length !== 3) return null;

  const vals = filled.map(c => c.value).sort((a, b) => b - a);
  const suits = filled.map(c => c.suit);
  const isFlush = new Set(suits).size === 1;
  const valCounts = vals.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {} as Record<number, number>);
  const counts = Object.values(valCounts).sort((a, b) => b - a);

  const isSeq = (
    (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1) ||
    (vals[0] === 14 && vals[1] === 3 && vals[2] === 2) ||
    (vals[0] === 14 && vals[1] === 13 && vals[2] === 12)
  );

  if (counts[0] === 3) return 'Trail';
  if (isFlush && isSeq) return 'Pure Sequence';
  if (isSeq) return 'Sequence';
  if (isFlush) return 'Flush';
  if (counts[0] === 2) return 'Pair';
  return 'High Card';
}

export function SetBuilder() {
  const {
    myCards, cardPlacement, selectedCard,
    placeCard, removeCardPlacement, setSelectedCard, buildSets
  } = useGameStore();

  // Build current sets grid: sets[setIdx][slotIdx] = Card | null
  const setsGrid: (Card | null)[][] = [[null, null, null], [null, null, null], [null, null, null]];
  const cardMap = new Map(myCards.map(c => [c.id, c]));

  for (const [cardIdStr, { setIndex, slotIndex }] of Object.entries(cardPlacement)) {
    const card = cardMap.get(Number(cardIdStr));
    if (card) setsGrid[setIndex][slotIndex] = card;
  }

  const placedIds = new Set(Object.keys(cardPlacement).map(Number));
  const unplacedCards = myCards.filter(c => !placedIds.has(c.id));

  const handleCardClick = useCallback((card: Card) => {
    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      return;
    }
    setSelectedCard(card);
  }, [selectedCard, setSelectedCard]);

  const handleSlotClick = useCallback((setIndex: SetIndex, slotIndex: SlotIndex) => {
    if (!selectedCard) return;

    const existing = setsGrid[setIndex][slotIndex];
    if (existing) {
      // Swap: remove existing from its slot, place selected card there
      removeCardPlacement(existing.id);
    }

    placeCard(selectedCard.id, setIndex, slotIndex);
    setSelectedCard(null);
  }, [selectedCard, setsGrid, placeCard, removeCardPlacement, setSelectedCard]);

  const handlePlacedCardClick = useCallback((card: Card) => {
    // If another card is selected, swap
    if (selectedCard && selectedCard.id !== card.id) {
      const existingPlacement = cardPlacement[card.id];
      const newPlacement = cardPlacement[selectedCard.id];

      removeCardPlacement(card.id);
      removeCardPlacement(selectedCard.id);

      if (existingPlacement) {
        placeCard(selectedCard.id, existingPlacement.setIndex, existingPlacement.slotIndex);
      }
      if (newPlacement) {
        placeCard(card.id, newPlacement.setIndex, newPlacement.slotIndex);
      }

      setSelectedCard(null);
    } else {
      // Deselect / lift card back to hand
      removeCardPlacement(card.id);
      setSelectedCard(card);
    }
  }, [selectedCard, cardPlacement, placeCard, removeCardPlacement, setSelectedCard]);

  const allPlaced = Object.keys(cardPlacement).length === 9;

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Instruction - More prominent */}
      <div className="flex justify-center">
        <div className="glass-panel-light px-6 py-2 rounded-2xl border border-white/5">
          {selectedCard ? (
            <p className="text-xs font-black uppercase tracking-widest text-yellow-400 animate-pulse">
              Place the {selectedCard.display}
            </p>
          ) : allPlaced ? (
            <p className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
              <span className="text-lg">✨</span> Strategy Locked — Ready to Submit
            </p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">
              Arrange your cards into 3 winning sets
            </p>
          )}
        </div>
      </div>

      {/* 3 Set Columns - Desktop Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        {setsGrid.map((setCards, si) => {
          const handName = quickEval(setCards);
          const hint = handName ? HAND_HINTS[handName] : null;

          return (
            <div key={si} className="relative flex flex-col">
              {/* Set Label */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#1a0f05] border border-yellow-900/50 shadow-xl">
                <p className="font-display text-[8px] sm:text-[10px] uppercase tracking-widest font-black text-yellow-500/80">
                  {SET_NAMES[si]}
                </p>
              </div>

              <div className={clsx(
                "glass-panel p-3 sm:p-5 pt-6 sm:pt-8 rounded-[2rem] border transition-all duration-500",
                hint ? "border-yellow-500/30 shadow-[0_20px_40px_-20px_rgba(201,153,58,0.2)]" : "border-white/5"
              )}>
                {/* Hand Hint */}
                <div className="h-6 flex items-center justify-center mb-4">
                  <AnimatePresence mode="wait">
                    {hint && (
                      <motion.div
                        key={handName}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10"
                      >
                        <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest" style={{ color: hint.color }}>
                          {hint.label}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3 Card Slots */}
                <div className="flex flex-col gap-3 items-center">
                  {setCards.map((card, slotIdx) => (
                    <div
                      key={slotIdx}
                      className={clsx(
                        'set-slot w-full aspect-[5/7] max-w-[80px]',
                        card ? 'occupied' : 'border-dashed border-white/10 hover:border-yellow-500/30 cursor-pointer',
                        !card && selectedCard ? 'droppable' : '',
                      )}
                      onClick={() => card
                        ? handlePlacedCardClick(card)
                        : handleSlotClick(si as SetIndex, slotIdx as SlotIndex)
                      }
                    >
                      {card ? (
                        <PlayingCard
                          card={card}
                          size="sm"
                          isSelected={selectedCard?.id === card.id}
                          onClick={() => handlePlacedCardClick(card)}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                           <span className="text-xl">🎴</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unplaced Hand - Drawer Style */}
      <AnimatePresence>
        {unplacedCards.length > 0 && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="glass-panel p-6 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />
            
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="font-display text-[10px] uppercase tracking-[0.3em] font-black text-white/40">
                Your Arsenal
              </h3>
              <div className="px-3 py-1 rounded-full bg-black/40 border border-white/5">
                <span className="text-[10px] font-black text-yellow-500">{unplacedCards.length} CARDS LEFT</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {unplacedCards.map((card, i) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="sm"
                  isSelected={selectedCard?.id === card.id}
                  onClick={() => handleCardClick(card)}
                  animateIn={false}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
