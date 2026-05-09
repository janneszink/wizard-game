from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.engine import (
    advance_to_next_round,
    choose_trump,
    create_game,
    get_winners,
    play_card,
    start_round,
    submit_prediction,
)
from app.exceptions import GameNotFoundError, WizardGameError
from app.models import GameState, Player
from app.schemas import (
    ChooseTrumpRequest,
    CreateGameRequest,
    GameResponse,
    GenericActionResponse,
    PlayCardRequest,
    SubmitPredictionRequest,
)
from app.storage import storage

app = FastAPI(title="Wizard Game API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_game_or_404(game_id: str) -> GameState:
    try:
        return storage.get(game_id)
    except GameNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def action_error(exc: WizardGameError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@app.get("/")
def health_check() -> dict:
    return {
        "status": "ok",
        "message": "Wizard Game API is running.",
    }


@app.post("/games", response_model=GameResponse)
def create_game_route(request: CreateGameRequest) -> GameResponse:
    try:
        game = create_game(
            request.player_names,
            variant_plus_minus_one=request.variant_plus_minus_one,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    storage.save(game)
    return GameResponse(game=game)


@app.get("/games", response_model=list[GameState])
def list_games_route() -> list[GameState]:
    return storage.list_games()


@app.get("/games/{game_id}", response_model=GameResponse)
def get_game_route(game_id: str) -> GameResponse:
    return GameResponse(game=get_game_or_404(game_id))


@app.post("/games/{game_id}/start-round", response_model=GenericActionResponse)
def start_round_route(game_id: str) -> GenericActionResponse:
    game = get_game_or_404(game_id)

    try:
        updated_game = start_round(game)
    except WizardGameError as exc:
        raise action_error(exc) from exc

    storage.save(updated_game)
    return GenericActionResponse(
        success=True,
        message="Round started.",
        game=updated_game,
    )


@app.post("/games/{game_id}/choose-trump", response_model=GenericActionResponse)
def choose_trump_route(
    game_id: str,
    request: ChooseTrumpRequest,
) -> GenericActionResponse:
    game = get_game_or_404(game_id)

    try:
        updated_game = choose_trump(game, request.suit)
    except WizardGameError as exc:
        raise action_error(exc) from exc

    storage.save(updated_game)
    return GenericActionResponse(
        success=True,
        message="Trump suit chosen.",
        game=updated_game,
    )


@app.post("/games/{game_id}/predict", response_model=GenericActionResponse)
def submit_prediction_route(
    game_id: str,
    request: SubmitPredictionRequest,
) -> GenericActionResponse:
    game = get_game_or_404(game_id)

    try:
        updated_game = submit_prediction(game, request.player_id, request.prediction)
    except WizardGameError as exc:
        raise action_error(exc) from exc

    storage.save(updated_game)
    return GenericActionResponse(
        success=True,
        message="Prediction submitted.",
        game=updated_game,
    )


@app.post("/games/{game_id}/play-card", response_model=GenericActionResponse)
def play_card_route(game_id: str, request: PlayCardRequest) -> GenericActionResponse:
    game = get_game_or_404(game_id)

    try:
        updated_game = play_card(game, request.player_id, request.card_id)
    except WizardGameError as exc:
        raise action_error(exc) from exc

    storage.save(updated_game)
    return GenericActionResponse(
        success=True,
        message="Card played.",
        game=updated_game,
    )


@app.post("/games/{game_id}/next-round", response_model=GenericActionResponse)
def next_round_route(game_id: str) -> GenericActionResponse:
    game = get_game_or_404(game_id)

    try:
        updated_game = advance_to_next_round(game)
    except WizardGameError as exc:
        raise action_error(exc) from exc

    storage.save(updated_game)
    return GenericActionResponse(
        success=True,
        message="Advanced to next round.",
        game=updated_game,
    )


@app.get("/games/{game_id}/winners")
def winners_route(game_id: str) -> dict[str, bool | list[Player]]:
    game = get_game_or_404(game_id)
    return {
        "success": True,
        "winners": get_winners(game),
    }


@app.delete("/games/{game_id}", response_model=GenericActionResponse)
def delete_game_route(game_id: str) -> GenericActionResponse:
    try:
        storage.delete(game_id)
    except GameNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return GenericActionResponse(
        success=True,
        message="Game deleted.",
    )
