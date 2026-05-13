from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models import GameState, Suit
from app.save_storage import SavedGame


class CreateGameRequest(BaseModel):
    player_names: list[str] = Field(min_length=3, max_length=6)
    variant_plus_minus_one: bool = False


class GameResponse(BaseModel):
    success: bool = True
    game: GameState


class ChooseTrumpRequest(BaseModel):
    suit: Suit


class SubmitPredictionRequest(BaseModel):
    player_id: str
    prediction: int = Field(ge=0)


class PlayCardRequest(BaseModel):
    player_id: str
    card_id: str


class GenericActionResponse(BaseModel):
    success: bool
    message: str
    game: Optional[GameState] = None


class SaveGameRequest(BaseModel):
    name: str = Field(min_length=1)
    player_colors: dict[str, str] = Field(default_factory=dict)
    score_history: list[Any] = Field(default_factory=list)


class SavedGameSummary(BaseModel):
    id: str
    name: str
    player_names: list[str]
    round_number: int
    phase: str
    created_at: str
    updated_at: str


class SavedGameResponse(BaseModel):
    success: bool = True
    saved_game: SavedGame
