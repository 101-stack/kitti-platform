"""
Game Logic Routes — Internal routes called by Node.js server
POST /api/evaluate-round   — Evaluate all player sets
POST /api/validate-sets    — Validate a player's submitted sets
"""
from fastapi import APIRouter, HTTPException
from dataclasses import asdict
import logging

from app.schemas.schemas import (
    EvaluateRoundRequest, EvaluateRoundResponse,
    ValidateSetsRequest, ValidateSetsResponse,
    SetResult
)
from app.services.game_logic import evaluate_all_sets, validate_sets

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/evaluate-round", response_model=EvaluateRoundResponse)
async def evaluate_round(data: EvaluateRoundRequest):
    """
    Evaluate all player sets and return ranked results with overall winner.
    Called by Node.js after all players submit.
    Protected by internal API key middleware.
    """
    try:
        player_sets = [
            {
                "user_id": ps.user_id,
                "username": ps.username or ps.user_id,
                "sets": ps.sets,
            }
            for ps in data.player_sets
        ]

        result = evaluate_all_sets(player_sets, data.options or {})

        set_results = [
            SetResult(
                set_index=sr.set_index,
                rankings=sr.rankings,
                winner=sr.winner,
                is_tie=sr.is_tie,
            )
            for sr in result.set_results
        ]

        return EvaluateRoundResponse(
            set_results=set_results,
            points_map=result.points_map,
            overall_winner=result.overall_winner,
            is_tie=result.is_tie,
        )

    except Exception as e:
        logger.error(f"evaluate_round error: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")


@router.post("/validate-sets", response_model=ValidateSetsResponse)
async def validate_player_sets(data: ValidateSetsRequest):
    """
    Validate that a player's submitted sets only use their dealt cards.
    Called by Node.js as a secondary server-side check.
    """
    try:
        is_valid, error_msg = validate_sets(data.sets, data.dealt_cards)
        return ValidateSetsResponse(valid=is_valid, error=error_msg)
    except Exception as e:
        logger.error(f"validate_sets error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
