import pytest
from unittest.mock import patch, MagicMock
from director.entrypoint.api import create_app


class TestConfig:
    DEBUG = True
    TESTING = True
    SECRET_KEY = "test-secret"
    LOGGING_CONFIG = {"version": 1, "disable_existing_loggers": False}
    DB_TYPE = "sqlite"
    ENV_PREFIX = "SERVER"


@pytest.fixture
def client():
    app = create_app(app_config=TestConfig)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_render_agent_rejects_invalid_agent_name(client):
    resp = client.post("/api/render/agent/bad-name!", json={})
    assert resp.status_code == 400
    body = resp.get_json()
    assert body["status"] == "error"
    assert "Invalid agent name" in body["error"]


def test_render_agent_rejects_unknown_agent(client):
    with patch("director.entrypoint.api.routes.ChatHandler") as MockHandler:
        resp = client.post("/api/render/agent/unknown_agent", json={
            "collection_id": "col-1",
            "video_id": "vid-1",
        })
        assert resp.status_code == 400
        body = resp.get_json()
        assert "not allowed for direct render execution" in body["error"]
        assert "unknown_agent" in body["error"]


def test_render_agent_requires_collection_and_video_id(client):
    with patch("director.entrypoint.api.routes.ChatHandler") as MockHandler:
        resp = client.post("/api/render/agent/subtitle", json={})
        assert resp.status_code == 400
        body = resp.get_json()
        assert "collection_id and video_id are required" in body["error"]


def test_render_agent_requires_params_to_be_object(client):
    with patch("director.entrypoint.api.routes.ChatHandler") as MockHandler:
        resp = client.post("/api/render/agent/subtitle", json={
            "collection_id": "col-1",
            "video_id": "vid-1",
            "params": "not-an-object",
        })
        assert resp.status_code == 400
        body = resp.get_json()
        assert "params must be a JSON object" in body["error"]


def test_render_agent_success_normalizes_response(client):
    mock_handler = MagicMock()
    mock_handler.execute_agent.return_value = {
        "status": "success",
        "agent": "subtitle",
        "sessionId": "sess-1",
        "conversationId": "conv-1",
        "collectionId": "col-1",
        "videoId": "vid-1",
        "videoUrl": "https://cdn.example.com/sub.mp4",
        "scenes": [],
        "highlights": [],
        "subtitles": None,
        "data": {"stream_url": "https://cdn.example.com/sub.mp4"},
        "error": None,
    }

    with patch("director.entrypoint.api.routes.ChatHandler", return_value=mock_handler):
        resp = client.post("/api/render/agent/subtitle", json={
            "collection_id": "col-1",
            "video_id": "vid-1",
            "params": {"video_language": "english"},
        })
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "success"
        assert body["agent"] == "subtitle"
        assert body["videoUrl"] == "https://cdn.example.com/sub.mp4"
        assert body["collectionId"] == "col-1"
        assert body["videoId"] == "vid-1"
        assert body["data"]["stream_url"] == "https://cdn.example.com/sub.mp4"


def test_render_agent_error_path_returns_500(client):
    with patch("director.entrypoint.api.routes.ChatHandler") as MockHandler:
        MockHandler.side_effect = Exception("Database connection failed")
        resp = client.post("/api/render/agent/scenes", json={
            "collection_id": "col-1",
            "video_id": "vid-1",
        })
        assert resp.status_code == 500
        body = resp.get_json()
        assert body["status"] == "error"
        assert "Database connection failed" in body["error"]
