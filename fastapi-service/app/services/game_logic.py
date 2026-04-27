"""
Kitti Game Logic Service
Python implementation of Kitti hand evaluation (mirrors Node.js engine).
Used by FastAPI for REST-based evaluation calls and analytics.
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import IntEnum


# ─── Hand Rankings ─────────────────────────────────────────────────────────────

class HandRank(IntEnum):
    HIGH_CARD = 1
    PAIR = 2
    FLUSH = 3
    SEQUENCE = 4
    PURE_SEQUENCE = 5
    TRAIL = 6


HAND_NAMES = {
    HandRank.HIGH_CARD: "High Card",
    HandRank.PAIR: "Pair",
    HandRank.FLUSH: "Flush",
    HandRank.SEQUENCE: "Sequence",
    HandRank.PURE_SEQUENCE: "Pure Sequence",
    HandRank.TRAIL: "Trail",
}


@dataclass
class HandEvaluation:
    rank: HandRank
    name: str
    tiebreakers: List[int]
    description: str


@dataclass
class SetResult:
    set_index: int
    rankings: List[Dict[str, Any]]
    winner: Optional[str]
    is_tie: bool


@dataclass
class RoundResult:
    set_results: List[SetResult]
    points_map: Dict[str, int]
    overall_winner: Optional[str]
    is_tie: bool


# ─── Card Validation ───────────────────────────────────────────────────────────

def validate_card(card: Dict) -> bool:
    """Validate a card object has required fields"""
    required = {"id", "suit", "value"}
    return required.issubset(card.keys()) and isinstance(card.get("value"), int)


def validate_sets(sets: List[List[Dict]], dealt_cards: List[Dict]) -> Tuple[bool, Optional[str]]:
    """
    Validate submitted sets against dealt cards.
    Returns (is_valid, error_message)
    """
    if not sets or len(sets) != 3:
        return False, "Must submit exactly 3 sets"

    for i, s in enumerate(sets):
        if not s or len(s) != 3:
            return False, f"Set {i+1} must have exactly 3 cards"

    submitted_ids = [c["id"] for s in sets for c in s]

    if len(set(submitted_ids)) != 9:
        return False, "Duplicate cards detected in submitted sets"

    dealt_id_set = {c["id"] for c in dealt_cards}
    for card_id in submitted_ids:
        if card_id not in dealt_id_set:
            return False, f"Card ID {card_id} was not in the dealt hand"

    return True, None


# ─── Hand Evaluator ────────────────────────────────────────────────────────────

def evaluate_hand(cards: List[Dict], options: Dict = None) -> HandEvaluation:
    """
    Evaluate a 3-card hand and return its rank.
    """
    if options is None:
        options = {}

    enable_235 = options.get("enable235Rule", False)

    if len(cards) != 3:
        raise ValueError(f"Hand must have exactly 3 cards, got {len(cards)}")

    sorted_cards = sorted(cards, key=lambda c: c["value"], reverse=True)
    values = [c["value"] for c in sorted_cards]
    suits = [c["suit"] for c in sorted_cards]
    displays = [c.get("display", f"{c['value']}{c['suit'][0].upper()}") for c in sorted_cards]

    is_flush = len(set(suits)) == 1
    is_seq = _is_sequence(values, enable_235)
    is_pure_seq = is_flush and is_seq

    value_counts: Dict[int, int] = {}
    for v in values:
        value_counts[v] = value_counts.get(v, 0) + 1

    counts = sorted(value_counts.values(), reverse=True)

    if counts[0] == 3:
        rank = HandRank.TRAIL
        tiebreakers = [values[0]]
    elif is_pure_seq:
        rank = HandRank.PURE_SEQUENCE
        tiebreakers = _sequence_tiebreaker(values, enable_235)
    elif is_seq:
        rank = HandRank.SEQUENCE
        tiebreakers = _sequence_tiebreaker(values, enable_235)
    elif is_flush:
        rank = HandRank.FLUSH
        tiebreakers = values[:]
    elif counts[0] == 2:
        rank = HandRank.PAIR
        pair_val = next(v for v, c in value_counts.items() if c == 2)
        kicker = next(v for v, c in value_counts.items() if c == 1)
        tiebreakers = [pair_val, kicker]
    else:
        rank = HandRank.HIGH_CARD
        tiebreakers = values[:]

    return HandEvaluation(
        rank=rank,
        name=HAND_NAMES[rank],
        tiebreakers=tiebreakers,
        description=f"{HAND_NAMES[rank]} ({', '.join(displays)})",
    )


def compare_hands(hand1: HandEvaluation, hand2: HandEvaluation) -> int:
    """
    Compare two evaluated hands.
    Returns: >0 if hand1 wins, <0 if hand2 wins, 0 if tie
    """
    if hand1.rank != hand2.rank:
        return hand1.rank - hand2.rank

    for t1, t2 in zip(hand1.tiebreakers, hand2.tiebreakers):
        diff = t1 - t2
        if diff != 0:
            return diff

    return 0


def evaluate_all_sets(
    player_sets: List[Dict[str, Any]],
    options: Dict = None,
) -> RoundResult:
    """
    Evaluate all players' sets and determine winner.
    player_sets: [{ "user_id": str, "sets": [[card, card, card], ...] }]
    """
    if options is None:
        options = {}

    num_sets = 3
    points_map: Dict[str, int] = {p["user_id"]: 0 for p in player_sets}
    set_results: List[SetResult] = []

    for set_index in range(num_sets):
        evaluations = []
        for player in player_sets:
            hand = player["sets"][set_index]
            try:
                evaluated = evaluate_hand(hand, options)
            except Exception as e:
                # Invalid hand — treat as lowest possible
                evaluated = HandEvaluation(HandRank.HIGH_CARD, "Invalid", [0, 0, 0], str(e))

            evaluations.append({
                "user_id": player["user_id"],
                "username": player.get("username", player["user_id"]),
                "hand": hand,
                "evaluated": evaluated,
            })

        # Sort by hand rank descending
        evaluations.sort(key=lambda e: (e["evaluated"].rank, e["evaluated"].tiebreakers), reverse=True)

        top = evaluations[0]
        is_win = (
            len(evaluations) < 2 or
            compare_hands(top["evaluated"], evaluations[1]["evaluated"]) > 0
        )

        if is_win:
            points_map[top["user_id"]] += 1

        rankings = [
            {
                "rank": idx + 1,
                "user_id": e["user_id"],
                "username": e["username"],
                "hand": e["evaluated"].description,
                "hand_name": e["evaluated"].name,
                "hand_rank": int(e["evaluated"].rank),
                "tiebreakers": e["evaluated"].tiebreakers,
            }
            for idx, e in enumerate(evaluations)
        ]

        set_results.append(SetResult(
            set_index=set_index,
            rankings=rankings,
            winner=top["user_id"] if is_win else None,
            is_tie=not is_win,
        ))

    # Determine overall winner
    sorted_points = sorted(points_map.items(), key=lambda x: x[1], reverse=True)
    overall_winner = None
    is_tie = False

    if sorted_points and sorted_points[0][1] > 0:
        if len(sorted_points) > 1 and sorted_points[0][1] == sorted_points[1][1]:
            is_tie = True
        else:
            overall_winner = sorted_points[0][0]

    return RoundResult(
        set_results=set_results,
        points_map=points_map,
        overall_winner=overall_winner,
        is_tie=is_tie,
    )


# ─── Private Helpers ───────────────────────────────────────────────────────────

def _is_sequence(values: List[int], enable_235: bool = False) -> bool:
    high, mid, low = values[0], values[1], values[2]

    if high - mid == 1 and mid - low == 1:
        return True
    if high == 14 and mid == 3 and low == 2:  # A-2-3 wheel
        return True
    if high == 14 and mid == 13 and low == 12:  # A-K-Q
        return True
    if enable_235 and high == 5 and mid == 3 and low == 2:  # 2-3-5
        return True

    return False


def _sequence_tiebreaker(values: List[int], enable_235: bool = False) -> List[int]:
    high, mid, low = values[0], values[1], values[2]
    if enable_235 and high == 5 and mid == 3 and low == 2:
        return [15]  # Artificial max value
    return [high]
