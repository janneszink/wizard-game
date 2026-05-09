from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_game_payload() -> dict:
    return {
        "player_names": ["Anna", "Ben", "Clara"],
        "variant_plus_minus_one": False,
    }


def test_health_check():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "message": "Wizard Game API is running.",
    }


def test_create_game_api():
    response = client.post("/games", json=create_game_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["game"]["players"]) == 3
    assert data["game"]["phase"] == "setup"


def test_create_game_rejects_too_few_players():
    response = client.post("/games", json={"player_names": ["Anna", "Ben"]})

    assert response.status_code == 422


def test_get_created_game_api():
    create_response = client.post("/games", json=create_game_payload())
    game_id = create_response.json()["game"]["id"]

    response = client.get(f"/games/{game_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["game"]["id"] == game_id


def test_start_round_api():
    create_response = client.post("/games", json=create_game_payload())
    game_id = create_response.json()["game"]["id"]

    response = client.post(f"/games/{game_id}/start-round")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Round started."
    assert data["game"]["phase"] in ["prediction", "trump_selection"]
    assert all(len(player["hand"]) == 1 for player in data["game"]["players"])


def test_get_missing_game_returns_404():
    response = client.get("/games/missing-game")

    assert response.status_code == 404
