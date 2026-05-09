from app.models import Card, CardType, PlayedCard, Suit


def determine_trump_from_card(card: Card | None, is_final_round: bool) -> Suit | None:
    if is_final_round:
        return None

    if card is None:
        return None

    if card.type == CardType.NUMBER:
        return card.suit

    return None


def requires_dealer_trump_choice(card: Card | None, is_final_round: bool) -> bool:
    if is_final_round:
        return False

    return card is not None and card.type == CardType.WIZARD


def get_led_suit(current_trick: list[PlayedCard]) -> Suit | None:
    if not current_trick:
        return None

    first_card = current_trick[0].card

    if first_card.type == CardType.WIZARD:
        return None

    for played in current_trick:
        if played.card.type == CardType.NUMBER:
            return played.card.suit

    return None


def trick_started_with_wizard(current_trick: list[PlayedCard]) -> bool:
    return bool(current_trick) and current_trick[0].card.type == CardType.WIZARD


def player_has_suit(hand: list[Card], suit: Suit) -> bool:
    return any(
        card.type == CardType.NUMBER and card.suit == suit
        for card in hand
    )


def find_card_in_hand(hand: list[Card], card_id: str) -> Card | None:
    for card in hand:
        if card.id == card_id:
            return card

    return None


def is_legal_play(
    card: Card,
    hand: list[Card],
    current_trick: list[PlayedCard],
) -> bool:
    if find_card_in_hand(hand, card.id) is None:
        return False

    if not current_trick:
        return True

    if card.type in [CardType.WIZARD, CardType.JESTER]:
        return True

    if trick_started_with_wizard(current_trick):
        return True

    led_suit = get_led_suit(current_trick)

    if led_suit is None:
        return True

    if player_has_suit(hand, led_suit):
        return card.type == CardType.NUMBER and card.suit == led_suit

    return True


def determine_trick_winner(
    trick: list[PlayedCard],
    trump_suit: Suit | None,
) -> str:
    if not trick:
        raise ValueError("Cannot determine winner of an empty trick.")

    for played in trick:
        if played.card.type == CardType.WIZARD:
            return played.player_id

    if trump_suit is not None:
        trump_cards = [
            played
            for played in trick
            if played.card.type == CardType.NUMBER
            and played.card.suit == trump_suit
        ]

        if trump_cards:
            return max(
                trump_cards,
                key=lambda played: played.card.value or 0,
            ).player_id

    led_suit = get_led_suit(trick)

    if led_suit is not None:
        led_cards = [
            played
            for played in trick
            if played.card.type == CardType.NUMBER
            and played.card.suit == led_suit
        ]

        if led_cards:
            return max(
                led_cards,
                key=lambda played: played.card.value or 0,
            ).player_id

    return trick[0].player_id