from app.models import Card, CardType, PlayedCard, Suit
from app.rules import get_led_suit, is_legal_play


def number(card_id: str, suit: Suit, value: int) -> Card:
    return Card(id=card_id, type=CardType.NUMBER, suit=suit, value=value)


def wizard(card_id: str = "wizard-1") -> Card:
    return Card(id=card_id, type=CardType.WIZARD)


def jester(card_id: str = "jester-1") -> Card:
    return Card(id=card_id, type=CardType.JESTER)


def test_first_player_can_play_any_card():
    red_5 = number("red-5", Suit.RED, 5)
    hand = [red_5]

    assert is_legal_play(red_5, hand, []) is True


def test_player_must_follow_suit_when_possible():
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)

    hand = [red_5, blue_9]
    trick = [PlayedCard(player_id="p1", card=red_5)]

    assert is_legal_play(blue_9, hand, trick) is False


def test_player_can_play_other_suit_when_no_led_suit_in_hand():
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)

    hand = [blue_9]
    trick = [PlayedCard(player_id="p1", card=red_5)]

    assert is_legal_play(blue_9, hand, trick) is True


def test_wizard_can_always_be_played():
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)
    wiz = wizard()

    hand = [blue_9, wiz]
    trick = [PlayedCard(player_id="p1", card=red_5)]

    assert is_legal_play(wiz, hand, trick) is True


def test_jester_can_always_be_played():
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)
    jest = jester()

    hand = [blue_9, jest]
    trick = [PlayedCard(player_id="p1", card=red_5)]

    assert is_legal_play(jest, hand, trick) is True


def test_if_trick_starts_with_wizard_any_card_is_legal():
    wiz = wizard()
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)

    hand = [blue_9]
    trick = [
        PlayedCard(player_id="p1", card=wiz),
        PlayedCard(player_id="p2", card=red_5),
    ]

    assert is_legal_play(blue_9, hand, trick) is True


def test_if_trick_starts_with_jester_first_number_sets_led_suit():
    jest = jester()
    red_5 = number("red-5", Suit.RED, 5)
    blue_9 = number("blue-9", Suit.BLUE, 9)

    trick = [
        PlayedCard(player_id="p1", card=jest),
        PlayedCard(player_id="p2", card=red_5),
    ]

    hand = [red_5, blue_9]

    assert get_led_suit(trick) == Suit.RED
    assert is_legal_play(blue_9, hand, trick) is False


def test_if_only_jesters_so_far_any_number_card_is_legal():
    jest = jester()
    red_5 = number("red-5", Suit.RED, 5)

    trick = [PlayedCard(player_id="p1", card=jest)]
    hand = [red_5]

    assert get_led_suit(trick) is None
    assert is_legal_play(red_5, hand, trick) is True