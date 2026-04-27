/**
 * Kitti Hand Evaluator
 * Evaluates 3-card hands according to Kitti/Teen Patti rules
 * Rank order (highest to lowest):
 *   1. Trail (Three of a Kind / AAA)
 *   2. Pure Sequence (Straight Flush)
 *   3. Sequence (Straight)
 *   4. Flush (Color)
 *   5. Pair
 *   6. High Card
 */

const HAND_RANKS = {
  TRAIL: 6,           // Three of a kind (e.g., AAA)
  PURE_SEQUENCE: 5,   // Straight flush (same suit, consecutive)
  SEQUENCE: 4,        // Straight (consecutive, mixed suits)
  FLUSH: 3,           // Flush (same suit, not consecutive)
  PAIR: 2,            // Two of a kind
  HIGH_CARD: 1,       // None of the above
};

const HAND_NAMES = {
  6: 'Trail',
  5: 'Pure Sequence',
  4: 'Sequence',
  3: 'Flush',
  2: 'Pair',
  1: 'High Card',
};

/**
 * Evaluate a 3-card hand
 * @param {Object[]} cards - Array of 3 card objects { value, suit }
 * @param {Object} options - { enable235Rule }
 * @returns {{ rank, name, tiebreakers, description }}
 */
const evaluateHand = (cards, options = {}) => {
  if (!cards || cards.length !== 3) {
    throw new Error('A hand must contain exactly 3 cards.');
  }

  const { enable235Rule = false } = options;

  // Sort by value descending for consistent comparison
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isSequence = _isSequence(values, enable235Rule);
  const isPureSequence = isFlush && isSequence;

  // Count occurrences for pairs / trails
  const valueCounts = _countValues(values);
  const counts = Object.values(valueCounts).sort((a, b) => b - a);

  let rank, name, tiebreakers;

  if (counts[0] === 3) {
    // Trail (three of a kind)
    rank = HAND_RANKS.TRAIL;
    name = HAND_NAMES[rank];
    tiebreakers = [values[0]]; // All same value
  } else if (isPureSequence) {
    rank = HAND_RANKS.PURE_SEQUENCE;
    name = HAND_NAMES[rank];
    tiebreakers = _sequenceTiebreaker(values, enable235Rule);
  } else if (isSequence) {
    rank = HAND_RANKS.SEQUENCE;
    name = HAND_NAMES[rank];
    tiebreakers = _sequenceTiebreaker(values, enable235Rule);
  } else if (isFlush) {
    rank = HAND_RANKS.FLUSH;
    name = HAND_NAMES[rank];
    tiebreakers = values; // All 3 values matter
  } else if (counts[0] === 2) {
    // Pair
    rank = HAND_RANKS.PAIR;
    name = HAND_NAMES[rank];
    const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
    const kicker = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 1));
    tiebreakers = [pairValue, kicker];
  } else {
    // High card
    rank = HAND_RANKS.HIGH_CARD;
    name = HAND_NAMES[rank];
    tiebreakers = values; // Compare all cards
  }

  return {
    rank,
    name,
    tiebreakers,
    description: `${name} (${cards.map(c => c.display).join(', ')})`,
  };
};

/**
 * Compare two evaluated hands
 * @returns {number} positive if hand1 wins, negative if hand2 wins, 0 if tie
 */
const compareHands = (hand1Eval, hand2Eval) => {
  if (hand1Eval.rank !== hand2Eval.rank) {
    return hand1Eval.rank - hand2Eval.rank;
  }
  // Same rank — compare tiebreakers positionally
  for (let i = 0; i < hand1Eval.tiebreakers.length; i++) {
    const diff = (hand1Eval.tiebreakers[i] || 0) - (hand2Eval.tiebreakers[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0; // True tie
};

/**
 * Determine the best set winner among multiple players
 * @param {Object[]} playerSets - [{ userId, sets: [hand1, hand2, hand3] }]
 * @param {Object} options
 * @returns {{ setResults: Object[][], overallWinner: string }}
 */
const evaluateAllSets = (playerSets, options = {}) => {
  const numSets = 3;
  const setResults = [];
  const pointsMap = {};

  // Initialize points
  playerSets.forEach(p => { pointsMap[p.userId] = 0; });

  for (let setIndex = 0; setIndex < numSets; setIndex++) {
    const evaluations = playerSets.map(player => ({
      userId: player.userId,
      hand: player.sets[setIndex],
      evaluated: evaluateHand(player.sets[setIndex], options),
    }));

    // Sort by hand strength descending
    evaluations.sort((a, b) => compareHands(b.evaluated, a.evaluated));

    const winner = evaluations[0];
    const isWin = evaluations.length < 2 || compareHands(winner.evaluated, evaluations[1].evaluated) > 0;

    if (isWin) {
      pointsMap[winner.userId] += 1;
    } else {
      // Tie — no points awarded for this set
    }

    setResults.push({
      setIndex,
      rankings: evaluations.map((e, rank) => ({
        rank: rank + 1,
        userId: e.userId,
        hand: e.evaluated.description,
        handName: e.evaluated.name,
        handRank: e.evaluated.rank,
        tiebreakers: e.evaluated.tiebreakers,
      })),
      winner: isWin ? winner.userId : null,
      isTie: !isWin,
    });
  }

  // Determine overall winner (Consecutive Win Rule)
  // Standard Kitti rule: You must win 2 sets CONSECUTIVELY to win the pot.
  let overallWinner = null;
  let isKitti = false; // "Kitti" means no consecutive winner

  const setWinners = setResults.map(r => r.winner); // [id1, id2, id3]
  
  if (setWinners[0] && setWinners[0] === setWinners[1]) {
    overallWinner = setWinners[0]; // Won 1 & 2
  } else if (setWinners[1] && setWinners[1] === setWinners[2]) {
    overallWinner = setWinners[1]; // Won 2 & 3
  } else {
    isKitti = true; // No consecutive wins
  }

  return {
    setResults,
    pointsMap,
    overallWinner,
    isTie: isKitti,
    isSalami: overallWinner && setWinners.every(w => w === overallWinner),
  };
};

// ─── Private Helpers ───────────────────────────────────────────────────────────

const _countValues = (values) => {
  return values.reduce((acc, v) => {
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
};

const _isSequence = (sortedValuesDesc, enable235 = false) => {
  // Standard sequence
  const [high, mid, low] = sortedValuesDesc;
  if (high - mid === 1 && mid - low === 1) return true;

  // Special case: A-2-3 (wheel)
  if (high === 14 && mid === 3 && low === 2) return true;

  // Special case: A-K-Q
  if (high === 14 && mid === 13 && low === 12) return true;

  // Optional rule: 2-3-5 is highest sequence (beats A-K-Q)
  if (enable235 && high === 5 && mid === 3 && low === 2) return true;

  return false;
};

const _sequenceTiebreaker = (sortedValuesDesc, enable235 = false) => {
  const [high, mid, low] = sortedValuesDesc;
  // 2-3-5 rule: treat as highest possible if enabled
  if (enable235 && high === 5 && mid === 3 && low === 2) {
    return [15]; // Artificial high value
  }
  return [high]; // Highest card in sequence determines winner
};

module.exports = {
  evaluateHand,
  compareHands,
  evaluateAllSets,
  HAND_RANKS,
  HAND_NAMES,
};
