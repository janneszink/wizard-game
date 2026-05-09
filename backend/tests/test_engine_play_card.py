from app.engine import create_game, play_card, submit_prediction
from app.models import Card, CardType, GamePhase, Suit


def number(card_id: str, suit: Suit, value: int) -> Card:
    return Card(id=card_id, type=CardType.NUMBER, suit=suit, value=value)


def prepare_simple_game():
    game = create_game(["Anna", "Ben", "Clara"])
    game.phase = GamePhase.PREDICTION
    game.current_player_index = 1
    game.round_number = 1
    game.trump_suit = Suit.RED

    game.players[0].hand = [number("blue-5", Suit.BLUE, 5)]
    game.players[1].hand = [number("blue-7", Suit.BLUE, 7)]
    game.players[2].hand = [number("red-2", Suit.RED, 2)]

    for _ in range(3):
        current = game.players[game.current_player_index]
        game = submit_prediction(game, current.id, 0)

    return game


def test_play_card_removes_card_from_hand():
    game = prepare_simple_game()
    current = game.players[game.current_player_index]
    card_id = current.hand[0].id

    game = play_card(game, current.id, card_id)

    assert len(current.hand) == 0
    assert len(game.current_trick) == 1


def test_completed_trick_scores_round_when_round_has_one_trick():
    game = prepare_simple_game()

    for _ in range(3):
        current = game.players[game.current_player_index]
        card_id = current.hand[0].id
        game = play_card(game, current.id, card_id)

    assert game.phase in [GamePhase.ROUND_SCORING, GamePhase.GAME_OVER]
    assert len(game.round_scores) == 3