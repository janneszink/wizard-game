import pytest

from app.engine import create_game, start_round, submit_prediction
from app.exceptions import InvalidPredictionError
from app.models import GamePhase


def force_prediction_phase(game):
    game.phase = GamePhase.PREDICTION
    game.current_player_index = 1
    return game


def test_submit_prediction_updates_player():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)
    game = force_prediction_phase(game)

    current_player = game.players[game.current_player_index]
    game = submit_prediction(game, current_player.id, 0)

    assert current_player.prediction == 0


def test_prediction_out_of_turn_raises_error():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)
    game = force_prediction_phase(game)

    wrong_player = game.players[0]

    with pytest.raises(InvalidPredictionError):
        submit_prediction(game, wrong_player.id, 0)


def test_prediction_above_round_number_raises_error():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)
    game = force_prediction_phase(game)

    current_player = game.players[game.current_player_index]

    with pytest.raises(InvalidPredictionError):
        submit_prediction(game, current_player.id, 2)


def test_all_predictions_move_game_to_playing():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)
    game = force_prediction_phase(game)

    for _ in range(3):
        current = game.players[game.current_player_index]
        game = submit_prediction(game, current.id, 0)

    assert game.phase == GamePhase.PLAYING