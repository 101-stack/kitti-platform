'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuthStore, useGameStore, useRoomStore } from '@/store/gameStore';
import { PlayingCard } from '@/components/game/PlayingCard';
import type { GameResult, SetResult, Card } from '@/types/game';

const HAND_COLORS: Record<string, string> = {
  Trail: '#f0c060',
  'Pure Sequence': '#60d0f0',
  Sequence: '#90d060',
  Flush: '#d090f0',
  Pair: '#f09060',
  'High Card': '#888',
};

export default function GameResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { gameResult, resetGame } = useGameStore();
  const { room, setRoom } = useRoomStore();

  useEffect(() => {
    if (!gameResult) return;
    // Confetti for winner
    if (gameResult.overallWinner === user?.id) {
      confetti({ particleCount: 120, spread: 80, colors: ['#c9993a', '#f0c060', '#fff'] });
    }
  }, [gameResult]);

  if (!gameResult || !user) {
    return (
      <div className="min-h-dvh felt-table flex items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Loading results...</p>
      </div>
    );
  }

  const { overallWinner, isTie, setResults, pointsMap, totalPot, playerSets } = gameResult;
  const winnerPlayer = playerSets.find(p => p.userId === overallWinner);
  const isWinner = overallWinner === user.id;

  const handlePlayAgain = () => {
    resetGame();
    if (room) {
      router.push(`/room/${room.roomId}`);
    } else {
      router.push('/lobby');
    }
  };

  return (
    <div className="min-h-dvh felt-table flex flex-col">
      {/* Header */}
      <header className="glass-panel border-b border-yellow-900/30 px-6 py-4 text-center">
        <h1 className="font-display text-2xl font-black" style={{ color: 'var(--gold-light)' }}>
          Game Over
        </h1>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-5">
        {/* Winner Banner */}
        <motion.div
          className="glass-panel gold-border p-6 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {isTie ? (
            <>
              <div className="text-5xl mb-2">🤝</div>
              <p className="font-display text-2xl font-black" style={{ color: 'var(--gold-light)' }}>
                It's a Tie!
              </p>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                No winner — pot retained
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">{isWinner ? '👑' : '🃏'}</div>
              <p className="font-display text-2xl font-black" style={{ color: 'var(--gold-light)' }}>
                {isWinner ? 'You Won!' : `${winnerPlayer?.username || 'Unknown'} Wins!`}
              </p>
              <p className="mt-1 flex items-center justify-center gap-2"
                style={{ color: 'var(--text-secondary)' }}>
                <span>🪙</span>
                <span className="font-bold text-lg" style={{ color: '#60d060' }}>
                  {isWinner ? `+${totalPot}` : `-${room?.entryFee || 100}`} coins
                </span>
              </p>

              {/* Points summary */}
              <div className="flex justify-center gap-4 mt-4">
                {Object.entries(pointsMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([uid, pts]) => {
                    const player = playerSets.find(p => p.userId === uid);
                    return (
                      <div key={uid} className="text-center">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {player?.username || uid}
                          {uid === user.id && ' (you)'}
                        </p>
                        <p className="font-display font-bold" style={{ color: uid === overallWinner ? 'var(--gold-light)' : 'var(--text-secondary)' }}>
                          {pts} set{pts !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </motion.div>

        {/* Set-by-set breakdown */}
        <div className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest px-1"
            style={{ color: 'var(--text-muted)' }}>
            Round Breakdown
          </h2>

          {setResults.map((setResult, si) => (
            <SetResultCard
              key={si}
              setResult={setResult}
              playerSets={playerSets}
              currentUserId={user.id}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3 pb-8">
          <button className="btn-gold w-full py-4 text-base" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button
            className="w-full py-3 rounded text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onClick={() => { resetGame(); router.push('/lobby'); }}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Set Result Card ───────────────────────────────────────────────────────────

function SetResultCard({
  setResult,
  playerSets,
  currentUserId,
}: {
  setResult: SetResult;
  playerSets: { userId: string; username: string; sets: Card[][] }[];
  currentUserId: string;
}) {
  return (
    <motion.div
      className="glass-panel p-4"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: setResult.setIndex * 0.1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-secondary)' }}>
          Set {setResult.setIndex + 1}
        </h3>
        {setResult.isTie ? (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
            Tie
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(96,208,96,0.15)', color: '#60d060', border: '1px solid rgba(96,208,96,0.3)' }}>
            {setResult.rankings[0]?.username} wins
          </span>
        )}
      </div>

      <div className="space-y-3">
        {setResult.rankings.map((ranking, ri) => {
          const playerSet = playerSets.find(p => p.userId === ranking.userId);
          const handCards = playerSet?.sets[setResult.setIndex] || [];
          const isMe = ranking.userId === currentUserId;
          const isWinner = ri === 0 && !setResult.isTie;

          return (
            <div key={ranking.userId}
              className="flex items-center gap-3 p-2 rounded-lg"
              style={{
                background: isWinner ? 'rgba(201,153,58,0.08)' : 'transparent',
                border: `1px solid ${isWinner ? 'rgba(201,153,58,0.2)' : 'transparent'}`,
              }}>
              <div className="w-6 text-center font-display font-bold text-sm"
                style={{ color: isWinner ? 'var(--gold)' : 'var(--text-muted)' }}>
                {isWinner ? '🏆' : `#${ri + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate"
                  style={{ color: isMe ? 'var(--gold-light)' : 'var(--text-secondary)' }}>
                  {ranking.username}{isMe ? ' (you)' : ''}
                </p>
                <p className="text-xs"
                  style={{ color: HAND_COLORS[ranking.handName] || 'var(--text-muted)' }}>
                  {ranking.handName}
                </p>
              </div>
              <div className="flex gap-0.5">
                {handCards.map((card) => (
                  <PlayingCard key={card.id} card={card} size="sm" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
