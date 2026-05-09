from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Suit(str, Enum):
    RED = "red"
    BLUE = "blue"
    GREEN = "green"
    YELLOW = "yellow"


class CardType(str, Enum):
    NUMBER = "number"
    WIZARD = "wizard"
    JESTER = "jester"


class GamePhase(str, Enum):
    SETUP = "setup"
    TRUMP_SELECTION = "trump_selection"
    PREDICTION = "prediction"
    PLAYING = "playing"
    ROUND_SCORING = "round_scoring"
    GAME_OVER = "game_over"


class Card(BaseModel):
    id: str
    type: CardType
    suit: Optional[Suit] = None
    value: Optional[int] = None


class Player(BaseModel):
    id: str
    name: str
    hand: list[Card] = Field(default_factory=list)
    prediction: Optional[int] = None
    tricks_won: int = 0
    score: int = 0


class PlayedCard(BaseModel):
    player_id: str
    card: Card


class RoundScore(BaseModel):
    player_id: str
    player_name: str
    prediction: int
    tricks_won: int
    score_change: int
    total_score: int


class GameState(BaseModel):
    id: str
    players: list[Player]
    dealer_index: int = 0
    current_player_index: int = 0
    round_number: int = 1
    max_rounds: int
    phase: GamePhase = GamePhase.SETUP

    deck: list[Card] = Field(default_factory=list)
    trump_card: Optional[Card] = None
    trump_suit: Optional[Suit] = None

    current_trick: list[PlayedCard] = Field(default_factory=list)
    completed_tricks: list[list[PlayedCard]] = Field(default_factory=list)

    variant_plus_minus_one: bool = False
    round_scores: list[RoundScore] = Field(default_factory=list)
    log: list[str] = Field(default_factory=list)