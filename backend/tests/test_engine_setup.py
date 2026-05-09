from app.engine import create_game, start_round
from app.models import GamePhase


def test_create_game_with_three_players():
    game = create_game(["Anna", "Ben", "Clara"])

    assert len(game.players) == 3
    assert game.max_rounds == 20
    assert game.phase == GamePhase.SETUP


def test_create_game_strips_empty_names():
    game = create_game([" Anna ", "Ben", "Clara", ""])

    assert len(game.players) == 3
    assert game.players[0].name == "Anna"


def test_start_round_deals_one_card_in_round_one():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)

    assert all(len(player.hand) == 1 for player in game.players)
    assert game.round_number == 1
    assert game.phase in [GamePhase.PREDICTION, GamePhase.TRUMP_SELECTION]


def test_round_one_has_correct_current_prediction_player_if_no_trump_selection():
    game = create_game(["Anna", "Ben", "Clara"])
    game = start_round(game)

    if game.phase == GamePhase.PREDICTION:
        assert game.current_player_index == 1