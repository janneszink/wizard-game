import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.exceptions import GameNotFoundError
from app.models import GameState


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SAVE_FILE = DATA_DIR / "saved_games.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SavedGame(BaseModel):
    id: str
    name: str
    game: GameState
    player_colors: dict[str, str] = Field(default_factory=dict)
    score_history: list[Any] = Field(default_factory=list)
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


class SavedGameStorage:
    def __init__(self, save_file: Path = SAVE_FILE) -> None:
        self.save_file = save_file
        self._ensure_save_file()

    def save(self, saved_game: SavedGame) -> SavedGame:
        saved_games = self._read_all()
        now = utc_now_iso()

        if saved_game.id in saved_games:
            saved_game.created_at = saved_games[saved_game.id].created_at

        saved_game.updated_at = now
        saved_games[saved_game.id] = saved_game
        self._write_all(saved_games)
        return saved_game

    def get(self, game_id: str) -> SavedGame:
        saved_games = self._read_all()

        try:
            return saved_games[game_id]
        except KeyError as exc:
            raise GameNotFoundError(f"Saved game '{game_id}' was not found.") from exc

    def delete(self, game_id: str) -> SavedGame:
        saved_games = self._read_all()

        try:
            saved_game = saved_games.pop(game_id)
        except KeyError as exc:
            raise GameNotFoundError(f"Saved game '{game_id}' was not found.") from exc

        self._write_all(saved_games)
        return saved_game

    def list_all(self) -> list[SavedGame]:
        return list(self._read_all().values())

    def exists(self, game_id: str) -> bool:
        return game_id in self._read_all()

    def _ensure_save_file(self) -> None:
        self.save_file.parent.mkdir(parents=True, exist_ok=True)

        if not self.save_file.exists():
            self.save_file.write_text("[]\n", encoding="utf-8")

    def _read_all(self) -> dict[str, SavedGame]:
        self._ensure_save_file()

        try:
            with self.save_file.open("r", encoding="utf-8") as file:
                raw_data = json.load(file)
        except json.JSONDecodeError:
            raw_data = []

        if not isinstance(raw_data, list):
            raw_data = []

        saved_games = [SavedGame.model_validate(saved_game) for saved_game in raw_data]
        return {saved_game.id: saved_game for saved_game in saved_games}

    def _write_all(self, saved_games: dict[str, SavedGame]) -> None:
        self._ensure_save_file()
        payload = [
            saved_game.model_dump(mode="json") for saved_game in saved_games.values()
        ]
        self.save_file.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


save_storage = SavedGameStorage()
