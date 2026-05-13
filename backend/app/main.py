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
from app.save_storage import SavedGame, save_storage
from app.schemas import (
    ChooseTrumpRequest,
    CreateGameRequest,
    GameResponse,
    GenericActionResponse,
    PlayCardRequest,
    SaveGameRequest,
    SavedGameResponse,
    SavedGameSummary,
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


def saved_game_or_404(game_id: str) -> SavedGame:
    try:
        return save_storage.get(game_id)
    except GameNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def saved_game_summary(saved_game: SavedGame) -> SavedGameSummary:
    return SavedGameSummary(
        id=saved_game.id,
        name=saved_game.name,
        player_names=[player.name for player in saved_game.game.players],
        round_number=saved_game.game.round_number,
        phase=saved_game.game.phase.value,
        created_at=saved_game.created_at,
        updated_at=saved_game.updated_at,
    )


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


@app.post("/games/{game_id}/save", response_model=SavedGameResponse)
def save_game_route(game_id: str, request: SaveGameRequest) -> SavedGameResponse:
    game = get_game_or_404(game_id)
    saved_game = SavedGame(
        id=game.id,
        name=request.name,
        game=game,
        player_colors=request.player_colors,
        score_history=request.score_history,
    )

    return SavedGameResponse(saved_game=save_storage.save(saved_game))


@app.get("/saved-games", response_model=list[SavedGameSummary])
def list_saved_games_route() -> list[SavedGameSummary]:
    return [
        saved_game_summary(saved_game)
        for saved_game in save_storage.list_all()
    ]


@app.get("/saved-games/{game_id}", response_model=SavedGameResponse)
def get_saved_game_route(game_id: str) -> SavedGameResponse:
    saved_game = saved_game_or_404(game_id)
    storage.save(saved_game.game)
    return SavedGameResponse(saved_game=saved_game)


@app.delete("/saved-games/{game_id}", response_model=GenericActionResponse)
def delete_saved_game_route(game_id: str) -> GenericActionResponse:
    try:
        save_storage.delete(game_id)
    except GameNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return GenericActionResponse(
        success=True,
        message="Saved game deleted.",
    )


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
