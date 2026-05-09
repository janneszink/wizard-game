from app.deck import create_deck, get_max_rounds, deal_cards
from app.models import CardType, Suit


def test_create_deck_has_60_cards():
    deck = create_deck()
    assert len(deck) == 60


def test_create_deck_has_52_number_cards():
    deck = create_deck()
    number_cards = [card for card in deck if card.type == CardType.NUMBER]
    assert len(number_cards) == 52


def test_create_deck_has_4_wizards_and_4_jesters():
    deck = create_deck()
    assert len([card for card in deck if card.type == CardType.WIZARD]) == 4
    assert len([card for card in deck if card.type == CardType.JESTER]) == 4


def test_each_suit_has_values_1_to_13():
    deck = create_deck()

    for suit in Suit:
        values = sorted(
            card.value
            for card in deck
            if card.type == CardType.NUMBER and card.suit == suit
        )
        assert values == list(range(1, 14))


def test_get_max_rounds():
    assert get_max_rounds(3) == 20
    assert get_max_rounds(4) == 15
    assert get_max_rounds(5) == 12
    assert get_max_rounds(6) == 10


def test_deal_cards_round_three_four_players():
    deck = create_deck()
    hands, remaining = deal_cards(deck, player_count=4, round_number=3)

    assert len(hands) == 4
    assert all(len(hand) == 3 for hand in hands)
    assert len(remaining) == 48