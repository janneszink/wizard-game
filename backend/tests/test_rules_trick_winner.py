import pytest

from app.models import Card, CardType, PlayedCard, Suit
from app.rules import (
    determine_trick_winner,
    determine_trump_from_card,
    requires_dealer_trump_choice,
)


def number(card_id: str, suit: Suit, value: int) -> Card:
    return Card(id=card_id, type=CardType.NUMBER, suit=suit, value=value)


def wizard(card_id: str) -> Card:
    return Card(id=card_id, type=CardType.WIZARD)


def jester(card_id: str) -> Card:
    return Card(id=card_id, type=CardType.JESTER)


def test_number_card_sets_trump_suit():
    card = number("red-8", Suit.RED, 8)

    assert determine_trump_from_card(card, is_final_round=False) == Suit.RED


def test_jester_means_no_trump():
    card = jester("jester-1")

    assert determine_trump_from_card(card, is_final_round=False) is None
    assert requires_dealer_trump_choice(card, is_final_round=False) is False


def test_wizard_requires_dealer_trump_choice():
    card = wizard("wizard-1")

    assert determine_trump_from_card(card, is_final_round=False) is None
    assert requires_dealer_trump_choice(card, is_final_round=False) is True


def test_final_round_has_no_trump_even_if_number_card_revealed():
    card = number("blue-13", Suit.BLUE, 13)

    assert determine_trump_from_card(card, is_final_round=True) is None
    assert requires_dealer_trump_choice(card, is_final_round=True) is False


def test_first_wizard_wins_even_if_later_wizard_is_played():
    trick = [
        PlayedCard(player_id="p1", card=wizard("wizard-1")),
        PlayedCard(player_id="p2", card=wizard("wizard-2")),
    ]

    assert determine_trick_winner(trick, trump_suit=Suit.RED) == "p1"


def test_highest_trump_wins_without_wizard():
    trick = [
        PlayedCard(player_id="p1", card=number("blue-13", Suit.BLUE, 13)),
        PlayedCard(player_id="p2", card=number("red-2", Suit.RED, 2)),
        PlayedCard(player_id="p3", card=number("red-10", Suit.RED, 10)),
    ]

    assert determine_trick_winner(trick, trump_suit=Suit.RED) == "p3"


def test_highest_led_suit_wins_without_wizard_or_trump():
    trick = [
        PlayedCard(player_id="p1", card=number("blue-5", Suit.BLUE, 5)),
        PlayedCard(player_id="p2", card=number("blue-12", Suit.BLUE, 12)),
        PlayedCard(player_id="p3", card=number("green-13", Suit.GREEN, 13)),
    ]

    assert determine_trick_winner(trick, trump_suit=Suit.RED) == "p2"


def test_first_jester_wins_if_all_cards_are_jesters():
    trick = [
        PlayedCard(player_id="p1", card=jester("jester-1")),
        PlayedCard(player_id="p2", card=jester("jester-2")),
        PlayedCard(player_id="p3", card=jester("jester-3")),
    ]

    assert determine_trick_winner(trick, trump_suit=Suit.RED) == "p1"


def test_jester_then_number_led_suit_winner():
    trick = [
        PlayedCard(player_id="p1", card=jester("jester-1")),
        PlayedCard(player_id="p2", card=number("green-7", Suit.GREEN, 7)),
        PlayedCard(player_id="p3", card=number("green-11", Suit.GREEN, 11)),
    ]

    assert determine_trick_winner(trick, trump_suit=None) == "p3"


def test_empty_trick_raises_error():
    with pytest.raises(ValueError):
        determine_trick_winner([], trump_suit=None)