import concurrent.futures
import contextvars

from director.utils import keys


def test_request_keys_only_and_filtered(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "server-key")
    monkeypatch.delenv("ALLOW_SERVER_KEYS", raising=False)
    keys.set_request_keys({"OPENAI_API_KEY": " user-key ", "SERVER_SECRET_KEY": "x", "FAL_KEY": 5})
    assert keys.get_key("OPENAI_API_KEY") == "user-key"
    assert keys.get_key("SERVER_SECRET_KEY") is None
    assert keys.get_key("FAL_KEY") is None
    keys.set_request_keys(None)
    assert keys.get_key("OPENAI_API_KEY") is None  # no silent fallback to server key


def test_server_fallback_is_opt_in(monkeypatch):
    monkeypatch.setenv("FAL_KEY", "server")
    monkeypatch.setenv("ALLOW_SERVER_KEYS", "true")
    keys.set_request_keys({})
    assert keys.get_key("FAL_KEY") == "server"


def test_json_header_and_thread_propagation():
    keys.set_request_keys('{"ELEVENLABS_API_KEY": "abc"}')
    with concurrent.futures.ThreadPoolExecutor() as ex:
        got = ex.submit(contextvars.copy_context().run, keys.get_key, "ELEVENLABS_API_KEY").result()
    assert got == "abc"
    keys.set_request_keys("not json")
    assert keys.get_key("ELEVENLABS_API_KEY") is None
