import importlib

import pytest


@pytest.fixture
def service_module(monkeypatch):
    monkeypatch.setenv('BROWSER_SERVICE_URL', 'http://browser-service')
    monkeypatch.setenv('MAX_RETRIES', '2')
    monkeypatch.setenv('RETRY_DELAY', '1')
    import DeepSeekService
    import BrowserClient
    import config
    importlib.reload(config)
    importlib.reload(BrowserClient)
    importlib.reload(DeepSeekService)
    return DeepSeekService


def test_chat_returns_browser_response(service_module):
    class FakeBrowserClient:
        def send_message(self, message):
            assert message == 'hello'
            return 'hi from browser'

    service = service_module.DeepSeekService()
    service.browser_client = FakeBrowserClient()

    assert service.chat('hello') == 'hi from browser'


def test_chat_rejects_invalid_message(service_module):
    service = service_module.DeepSeekService()

    with pytest.raises(ValueError):
        service.chat('')
