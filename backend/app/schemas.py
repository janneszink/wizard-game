from typing import Optional

from pydantic import BaseModel, Field

from app.models import GameState, Suit


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
