'use client';

import { motion } from 'framer-motion';
import type { Card } from '@/types/game';
import clsx from 'clsx';

interface PlayingCardProps {
  card: Card;
  isSelected?: boolean;
  isPlaced?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  animateIn?: boolean;
  animateDelay?: number;
  faceDown?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const isRed = (suit: string) => suit === 'hearts' || suit === 'diamonds';

const sizeClasses = {
  sm: { card: 'w-[var(--card-w-sm)] h-[var(--card-h-sm)]', value: 'text-[11px]', suit: 'text-[11px]', center: 'text-xl' },
  md: { card: 'w-[var(--card-w-md)] h-[var(--card-h-md)]', value: 'text-[13px]', suit: 'text-[13px]', center: 'text-3xl' },
  lg: { card: 'w-[var(--card-w-lg)] h-[var(--card-h-lg)]', value: 'text-[15px]', suit: 'text-[15px]', center: 'text-4xl' },
};

export function PlayingCard({
  card,
  isSelected = false,
  isPlaced = false,
  onClick,
  size = 'md',
  animateIn = false,
  animateDelay = 0,
  faceDown = false,
}: PlayingCardProps) {
  const sz = sizeClasses[size];
  const red = isRed(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit];

  const cardContent = faceDown ? (
    <CardBackContent size={size} />
  ) : (
    <div className="h-full w-full p-1.5 flex flex-col justify-between relative overflow-hidden">
      {/* Texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* Top-left corner */}
      <div className="flex flex-col items-center leading-none self-start z-10">
        <span className={clsx(sz.value, 'font-black')} style={{ color: red ? 'var(--red)' : 'var(--black)' }}>
          {card.displayValue}
        </span>
        <span className={clsx(sz.suit, 'mt-0.5')} style={{ color: red ? 'var(--red)' : 'var(--black)' }}>
          {symbol}
        </span>
      </div>

      {/* Center suit - Stylized */}
      <div className={clsx('absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300', sz.center)}
        style={{ color: red ? 'var(--red)' : 'var(--black)', opacity: isSelected ? 0.15 : 0.08 }}>
        {symbol}
      </div>

      {/* Bottom-right corner (inverted) */}
      <div className="flex flex-col items-center leading-none self-end rotate-180 z-10">
        <span className={clsx(sz.value, 'font-black')} style={{ color: red ? 'var(--red)' : 'var(--black)' }}>
          {card.displayValue}
        </span>
        <span className={clsx(sz.suit, 'mt-0.5')} style={{ color: red ? 'var(--red)' : 'var(--black)' }}>
          {symbol}
        </span>
      </div>
    </div>
  );

  const motionProps = animateIn ? {
    initial: { opacity: 0, y: -100, rotate: -25, scale: 0.5 },
    animate: { opacity: 1, y: 0, rotate: 0, scale: 1 },
    transition: {
      delay: animateDelay,
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  } : {};

  return (
    <motion.div
      {...motionProps}
      onClick={onClick}
      className={clsx(
        'playing-card relative group',
        sz.card,
        isSelected && 'selected',
        isPlaced && 'opacity-40 grayscale-[0.5] scale-95 pointer-events-none',
        onClick && 'cursor-pointer active:scale-95',
      )}
      whileHover={onClick && !isSelected ? { y: -8, scale: 1.05, rotate: 1 } : {}}
    >
      {cardContent}
      
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-yellow-500 shadow-[0_0_20px_rgba(201,153,58,0.4)] pointer-events-none z-20" />
      )}
    </motion.div>
  );
}

function CardBackContent({ size }: { size: string }) {
  return (
    <div className="h-full w-full p-1.5">
      <div className="h-full w-full rounded-lg bg-[#1a0f05] relative overflow-hidden flex items-center justify-center border border-yellow-900/30">
        {/* Ornate Pattern */}
        <div className="absolute inset-0 opacity-20" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c9993a' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '12px 12px'
          }} 
        />
        <div className="relative z-10 w-3/4 h-3/4 border border-yellow-500/20 rounded-md flex items-center justify-center">
           <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(201,153,58,0.6)]">🎴</span>
        </div>
        {/* Shimmer effect */}
        <div className="absolute inset-0 animate-shimmer pointer-events-none" />
      </div>
    </div>
  );
}

export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = sizeClasses[size];
  return (
    <div className={clsx('playing-card relative pointer-events-none', sz.card)}>
      <CardBackContent size={size} />
    </div>
  );
}

