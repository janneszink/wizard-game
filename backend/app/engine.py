import uuid

from app.deck import create_deck, deal_cards, get_max_rounds, shuffle_deck
from app.exceptions import (
    IllegalMoveError,
    InvalidCardError,
    InvalidPhaseError,
    InvalidPlayerError,
    InvalidPredictionError,
)
from app.models import (
    Card,
    CardType,
    GamePhase,
    GameState,
    PlayedCard,
    Player,
    RoundScore,
    Suit,
)
from app.rules import (
    determine_trick_winner,
    determine_trump_from_card,
    find_card_in_hand,
    is_legal_play,
    requires_dealer_trump_choice,
)
from app.scoring import calculate_score_change


def create_game(player_names: list[str], variant_plus_minus_one: bool = False) -> GameState:
    cleaned_names = [name.strip() for name in player_names if name.strip()]

    if len(cleaned_names) < 3 or len(cleaned_names) > 6:
        raise ValueError("Wizard requires between 3 and 6 players.")

    if len(set(cleaned_names)) != len(cleaned_names):
        raise ValueError("Player names must be unique.")

    players = [
        Player(id=f"player-{index + 1}", name=name)
        for index, name in enumerate(cleaned_names)
    ]

    return GameState(
        id=str(uuid.uuid4()),
        players=players,
        dealer_index=0,
        current_player_index=1 % len(players),
        round_number=1,
        max_rounds=get_max_rounds(len(players)),
        phase=GamePhase.SETUP,
        variant_plus_minus_one=variant_plus_minus_one,
        log=["Game created."],
    )


def get_player(game: GameState, player_id: str) -> Player:
    for player in game.players:
        if player.id == player_id:
            return player

    raise InvalidPlayerError(f"Player '{player_id}' does not exist.")


def get_player_index(game: GameState, player_id: str) -> int:
    for index, player in enumerate(game.players):
        if player.id == player_id:
            return index

    raise InvalidPlayerError(f"Player '{player_id}' does not exist.")


def get_current_player(game: GameState) -> Player:
    return game.players[game.current_player_index]


def next_player_index(game: GameState, from_index: int | None = None) -> int:
    start = game.current_player_index if from_index is None else from_index
    return (start + 1) % len(game.players)


def prediction_start_index(game: GameState) -> int:
    return (game.dealer_index + 1) % len(game.players)


def start_round(game: GameState) -> GameState:
    if game.phase not in [GamePhase.SETUP, GamePhase.ROUND_SCORING]:
        raise InvalidPhaseError("Cannot start a new round from the current phase.")

    for player in game.players:
        player.hand = []
        player.prediction = None
        player.tricks_won = 0

    game.current_trick = []
    game.completed_tricks = []
    game.round_scores = []

    deck = shuffle_deck(create_deck())
    hands, remaining_deck = deal_cards(deck, len(game.players), game.round_number)

    for index, hand in enumerate(hands):
        game.players[index].hand = hand

    is_final_round = game.round_number == game.max_rounds
    game.deck = remaining_deck

    if is_final_round:
        game.trump_card = None
        game.trump_suit = None
        game.phase = GamePhase.PREDICTION
        game.current_player_index = prediction_start_index(game)
        game.log.append(f"Round {game.round_number} started. Final round has no trump.")
        return game

    game.trump_card = remaining_deck[0] if remaining_deck else None
    game.trump_suit = determine_trump_from_card(game.trump_card, is_final_round)

    if requires_dealer_trump_choice(game.trump_card, is_final_round):
        game.phase = GamePhase.TRUMP_SELECTION
        game.current_player_index = game.dealer_index
        game.log.append("Trump card is a Wizard. Dealer must choose trump suit.")
    else:
        game.phase = GamePhase.PREDICTION
        game.current_player_index = prediction_start_index(game)

        if game.trump_suit is None:
            game.log.append(f"Round {game.round_number} started. No trump this round.")
        else:
            game.log.append(
                f"Round {game.round_number} started. Trump is {game.trump_suit.value}."
            )

    return game


def choose_trump(game: GameState, suit: Suit) -> GameState:
    if game.phase != GamePhase.TRUMP_SELECTION:
        raise InvalidPhaseError("Trump selection is not currently required.")

    if game.trump_card is None or game.trump_card.type != CardType.WIZARD:
        raise InvalidPhaseError("Dealer can only choose trump when the revealed card is a Wizard.")

    game.trump_suit = suit
    game.phase = GamePhase.PREDICTION
    game.current_player_index = prediction_start_index(game)
    game.log.append(f"Dealer chose {suit.value} as trump.")

    return game


def total_predictions(game: GameState) -> int:
    return sum(
        player.prediction
        for player in game.players
        if player.prediction is not None
    )


def all_predictions_submitted(game: GameState) -> bool:
    return all(player.prediction is not None for player in game.players)


def validate_prediction(game: GameState, player_id: str, prediction: int) -> None:
    if game.phase != GamePhase.PREDICTION:
        raise InvalidPhaseError("Predictions are not being accepted right now.")

    current_player = get_current_player(game)

    if current_player.id != player_id:
        raise InvalidPredictionError(f"It is currently {current_player.name}'s turn to predict.")

    if prediction < 0 or prediction > game.round_number:
        raise InvalidPredictionError(f"Prediction must be between 0 and {game.round_number}.")

    if game.variant_plus_minus_one:
        remaining_unsubmitted = sum(
            1
            for player in game.players
            if player.prediction is None and player.id != player_id
        )

        if remaining_unsubmitted == 0:
            projected_total = total_predictions(game) + prediction
            if projected_total == game.round_number:
                raise InvalidPredictionError(
                    "With the plus/minus one variant, total predictions cannot equal the number of tricks."
                )


def submit_prediction(game: GameState, player_id: str, prediction: int) -> GameState:
    validate_prediction(game, player_id, prediction)

    player = get_player(game, player_id)
    player.prediction = prediction
    game.log.append(f"{player.name} predicted {prediction} trick(s).")

    if all_predictions_submitted(game):
        game.phase = GamePhase.PLAYING
        game.current_player_index = prediction_start_index(game)
        game.log.append("All predictions submitted. Trick play begins.")
    else:
        game.current_player_index = next_player_index(game)

    return game


def remove_card_from_hand(player: Player, card_id: str) -> Card:
    for index, card in enumerate(player.hand):
        if card.id == card_id:
            return player.hand.pop(index)

    raise InvalidCardError(f"Card '{card_id}' is not in {player.name}'s hand.")


def play_card(game: GameState, player_id: str, card_id: str) -> GameState:
    if game.phase != GamePhase.PLAYING:
        raise InvalidPhaseError("Cards cannot be played right now.")

    current_player = get_current_player(game)

    if current_player.id != player_id:
        raise InvalidPlayerError(f"It is currently {current_player.name}'s turn.")

    card = find_card_in_hand(current_player.hand, card_id)

    if card is None:
        raise InvalidCardError(f"Card '{card_id}' is not in {current_player.name}'s hand.")

    if not is_legal_play(card, current_player.hand, game.current_trick):
        raise IllegalMoveError("This card cannot be played right now.")

    played_card = remove_card_from_hand(current_player, card_id)
    game.current_trick.append(PlayedCard(player_id=player_id, card=played_card))
    game.log.append(f"{current_player.name} played {describe_card(played_card)}.")

    if len(game.current_trick) == len(game.players):
        finish_trick(game)
    else:
        game.current_player_index = next_player_index(game)

    return game


def finish_trick(game: GameState) -> None:
    winner_id = determine_trick_winner(game.current_trick, game.trump_suit)
    winner = get_player(game, winner_id)
    winner.tricks_won += 1

    game.completed_tricks.append(game.current_trick.copy())
    game.current_trick = []

    winner_index = get_player_index(game, winner_id)
    game.current_player_index = winner_index

    game.log.append(f"{winner.name} won the trick.")

    if len(game.completed_tricks) == game.round_number:
        score_round(game)
    else:
        game.log.append(f"{winner.name} starts the next trick.")


def score_round(game: GameState) -> None:
    game.phase = GamePhase.ROUND_SCORING
    game.round_scores = []

    for player in game.players:
        if player.prediction is None:
            raise InvalidPredictionError(f"{player.name} has no prediction.")

        score_change = calculate_score_change(player.prediction, player.tricks_won)
        player.score += score_change

        game.round_scores.append(
            RoundScore(
                player_id=player.id,
                player_name=player.name,
                prediction=player.prediction,
                tricks_won=player.tricks_won,
                score_change=score_change,
                total_score=player.score,
            )
        )

        game.log.append(
            f"{player.name}: predicted {player.prediction}, "
            f"won {player.tricks_won}, scored {score_change}."
        )

    if game.round_number == game.max_rounds:
        game.phase = GamePhase.GAME_OVER
        game.log.append("Game over.")
    else:
        game.log.append(f"Round {game.round_number} scored.")


def advance_to_next_round(game: GameState) -> GameState:
    if game.phase != GamePhase.ROUND_SCORING:
        raise InvalidPhaseError("Cannot advance to next round right now.")

    game.round_number += 1
    game.dealer_index = next_player_index(game, game.dealer_index)
    game.current_player_index = prediction_start_index(game)
    game.phase = GamePhase.SETUP
    game.log.append(f"Advanced to round {game.round_number}.")

    return start_round(game)


def get_winners(game: GameState) -> list[Player]:
    highest_score = max(player.score for player in game.players)
    return [player for player in game.players if player.score == highest_score]


def describe_card(card: Card) -> str:
    if card.type == CardType.WIZARD:
        return "Wizard"

    if card.type == CardType.JESTER:
        return "Jester"

    return f"{card.suit.value} {card.value}"