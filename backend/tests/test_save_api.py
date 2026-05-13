import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app
from app.save_storage import SavedGameStorage


client = TestClient(app)


@pytest.fixture()
def isolated_save_storage(tmp_path, monkeypatch):
    test_storage = SavedGameStorage(tmp_path / "saved_games.json")
    monkeypatch.setattr(main_module, "save_storage", test_storage)
    return test_storage


def create_game_payload(player_names: list[str] | None = None) -> dict:
    return {
        "player_names": player_names or ["Anna", "Ben", "Clara"],
        "variant_plus_minus_one": False,
    }


def create_game(player_names: list[str] | None = None) -> dict:
    response = client.post("/games", json=create_game_payload(player_names))
    assert response.status_code == 200
    return response.json()["game"]


def save_game(game_id: str, name: str = "Friday Night Wizard") -> dict:
    response = client.post(
        f"/games/{game_id}/save",
        json={
            "name": name,
            "player_colors": {
                "player-1": "blue",
                "player-2": "green",
            },
            "score_history": [{"roundNumber": 1, "scores": []}],
        },
    )
    assert response.status_code == 200
    return response.json()["saved_game"]


def test_save_active_game(isolated_save_storage):
    game = create_game()

    saved_game = save_game(game["id"])

    assert saved_game["id"] == game["id"]
    assert saved_game["name"] == "Friday Night Wizard"
    assert saved_game["game"]["id"] == game["id"]
    assert saved_game["player_colors"] == {
        "player-1": "blue",
        "player-2": "green",
    }
    assert saved_game["score_history"] == [{"roundNumber": 1, "scores": []}]
    assert saved_game["created_at"]
    assert saved_game["updated_at"]


def test_save_missing_active_game_returns_404(isolated_save_storage):
    response = client.post(
        "/games/missing-game/save",
        json={"name": "Missing Game"},
    )

    assert response.status_code == 404


def test_list_saved_games(isolated_save_storage):
    first_game = create_game(["Anna", "Ben", "Clara"])
    second_game = create_game(["Dina", "Eli", "Fran"])
    save_game(first_game["id"], "First Save")
    save_game(second_game["id"], "Second Save")

    response = client.get("/saved-games")

    assert response.status_code == 200
    summaries = response.json()
    saved_names = {summary["name"] for summary in summaries}
    assert {"First Save", "Second Save"}.issubset(saved_names)

    first_summary = next(summary for summary in summaries if summary["name"] == "First Save")
    assert first_summary["id"] == first_game["id"]
    assert first_summary["player_names"] == ["Anna", "Ben", "Clara"]
    assert first_summary["round_number"] == 1
    assert first_summary["phase"] == "setup"
    assert first_summary["created_at"]
    assert first_summary["updated_at"]


def test_load_saved_game_restores_active_game(isolated_save_storage):
    game = create_game()
    save_game(game["id"], "Resume Me")
    delete_active_response = client.delete(f"/games/{game['id']}")
    assert delete_active_response.status_code == 200

    response = client.get(f"/saved-games/{game['id']}")

    assert response.status_code == 200
    saved_game = response.json()["saved_game"]
    assert saved_game["id"] == game["id"]
    assert saved_game["name"] == "Resume Me"

    restored_response = client.get(f"/games/{game['id']}")
    assert restored_response.status_code == 200
    assert restored_response.json()["game"]["id"] == game["id"]


def test_delete_saved_game(isolated_save_storage):
    game = create_game()
    save_game(game["id"])

    response = client.delete(f"/saved-games/{game['id']}")

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"] == "Saved game deleted."
    assert isolated_save_storage.exists(game["id"]) is False


def test_missing_saved_game_returns_404(isolated_save_storage):
    get_response = client.get("/saved-games/missing-game")
    delete_response = client.delete("/saved-games/missing-game")

    assert get_response.status_code == 404
    assert delete_response.status_code == 404
