import random
from app.models import Card, CardType, Suit


def create_deck() -> list[Card]:
    deck: list[Card] = []

    for suit in Suit:
        for value in range(1, 14):
            deck.append(
                Card(
                    id=f"{suit.value}-{value}",
                    type=CardType.NUMBER,
                    suit=suit,
                    value=value,
                )
            )

    for index in range(1, 5):
        deck.append(Card(id=f"wizard-{index}", type=CardType.WIZARD))
        deck.append(Card(id=f"jester-{index}", type=CardType.JESTER))

    return deck


def shuffle_deck(deck: list[Card]) -> list[Card]:
    shuffled = deck.copy()
    random.shuffle(shuffled)
    return shuffled


def get_max_rounds(player_count: int) -> int:
    if player_count < 3 or player_count > 6:
        raise ValueError("Wizard requires 3 to 6 players.")

    return 60 // player_count


def deal_cards(
    deck: list[Card],
    player_count: int,
    round_number: int,
) -> tuple[list[list[Card]], list[Card]]:
    cards_needed = player_count * round_number

    if cards_needed > len(deck):
        raise ValueError("Not enough cards to deal this round.")

    hands: list[list[Card]] = [[] for _ in range(player_count)]

    for card_index in range(cards_needed):
        player_index = card_index % player_count
        hands[player_index].append(deck[card_index])

    remaining_deck = deck[cards_needed:]

    return hands, remaining_deck