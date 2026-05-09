from app.exceptions import GameNotFoundError
from app.models import GameState


class GameStorage:
    def __init__(self) -> None:
        self._games: dict[str, GameState] = {}

    def save(self, game: GameState) -> GameState:
        self._games[game.id] = game
        return game

    def get(self, game_id: str) -> GameState:
        try:
            return self._games[game_id]
        except KeyError as exc:
            raise GameNotFoundError(f"Game '{game_id}' was not found.") from exc

    def delete(self, game_id: str) -> GameState:
        try:
            return self._games.pop(game_id)
        except KeyError as exc:
            raise GameNotFoundError(f"Game '{game_id}' was not found.") from exc

    def list_games(self) -> list[GameState]:
        return list(self._games.values())


storage = GameStorage()
