"""Minimal OpenAI-compatible wrapper for local browser execution via PyScript."""

import asyncio
import json
from types import SimpleNamespace
from typing import Any, Dict

import js

try:
    import pyscript as _pyscript
except Exception:
    _pyscript = None

try:
    import pyodide.webloop as _pyodide_webloop
except Exception:
    _pyodide_webloop = None

try:
    from pyscript import window as _pyscript_window
except Exception:
    _pyscript_window = None


def _to_ns(value: Any) -> Any:
    if isinstance(value, dict):
        return SimpleNamespace(**{k: _to_ns(v) for k, v in value.items()})
    if isinstance(value, list):
        return [_to_ns(v) for v in value]
    return value


def _run_sync(coro):
    if _pyodide_webloop is not None:
        runner = getattr(_pyodide_webloop, "run_until_complete", None)
        if callable(runner):
            try:
                return runner(coro)
            except Exception:
                pass

    if _pyscript is not None:
        running_in_worker = bool(getattr(_pyscript, "RUNNING_IN_WORKER", False))
        sync_bridge = getattr(_pyscript, "sync", None)

        if running_in_worker and sync_bridge is not None:
            for method_name in ("run", "await", "wait", "sync", "call"):
                method = getattr(sync_bridge, method_name, None)
                if callable(method):
                    try:
                        return method(coro)
                    except Exception:
                        pass

            if callable(sync_bridge):
                try:
                    return sync_bridge(coro)
                except Exception:
                    pass

    try:
        return asyncio.run(coro)
    except RuntimeError as exc:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = None

        if loop is not None and not loop.is_running():
            return loop.run_until_complete(coro)

        raise RuntimeError(
            "Synchronous OpenAI calls cannot run inside the active event loop in this runtime. "
            "Use AsyncOpenAI in async code paths."
        ) from exc


async def _request(payload: Dict[str, Any]) -> Dict[str, Any]:
    bridge = _get_js_bridge()
    response_json = await bridge.modelCoderRequest(json.dumps(payload))
    return json.loads(str(response_json))


async def _next_chunk(stream_id: str) -> Dict[str, Any]:
    bridge = _get_js_bridge()
    chunk_json = await bridge.modelCoderNextStreamChunk(stream_id)
    return json.loads(str(chunk_json))


def _safe_getattr(obj: Any, attr: str):
    try:
        return getattr(obj, attr)
    except Exception:
        return None


def _has_bridge(obj: Any) -> bool:
    if obj is None:
        return False
    return _safe_getattr(obj, "modelCoderRequest") is not None and _safe_getattr(obj, "modelCoderNextStreamChunk") is not None


def _get_js_bridge():
    candidates = []

    if _pyscript_window is not None:
        candidates.append(_pyscript_window)

    candidates.append(js)

    for attr in ("globalThis", "window", "self"):
        obj = _safe_getattr(js, attr)
        if obj is not None:
            candidates.append(obj)

    for candidate in candidates:
        if _has_bridge(candidate):
            return candidate

    raise OpenAIError(
        "Model bridge not available in this Python runtime. "
        "Missing modelCoderRequest/modelCoderNextStreamChunk on available JS globals."
    )


class OpenAIError(Exception):
    pass


class _BaseStream:
    def __init__(self, stream_id: str):
        self.stream_id = stream_id

    def __iter__(self):
        return self

    def __next__(self):
        while True:
            result = _run_sync(_next_chunk(self.stream_id))
            if result.get("error"):
                raise OpenAIError(result["error"])

            if result.get("done"):
                raise StopIteration

            chunk = result.get("chunk")
            if chunk is None:
                continue

            return _to_ns(chunk)


class _AsyncBaseStream:
    def __init__(self, stream_id: str):
        self.stream_id = stream_id

    def __aiter__(self):
        return self

    async def __anext__(self):
        while True:
            result = await _next_chunk(self.stream_id)
            if result.get("error"):
                raise OpenAIError(result["error"])

            if result.get("done"):
                raise StopAsyncIteration

            chunk = result.get("chunk")
            if chunk is None:
                continue

            return _to_ns(chunk)


def _validate_message_list(messages):
    if not isinstance(messages, list):
        raise ValueError("messages/input must be a list of role/content objects")

    allowed = {"developer", "system", "user", "assistant"}
    for msg in messages:
        if not isinstance(msg, dict):
            raise ValueError("each message must be a dict")
        role = msg.get("role")
        if role not in allowed:
            raise ValueError("message role must be one of developer, user, assistant")
        if "content" not in msg:
            raise ValueError("each message must include content")


class ChatCompletionsStream(_BaseStream):
    pass


class ResponsesStream(_BaseStream):
    pass


class AsyncChatCompletionsStream(_AsyncBaseStream):
    pass


class AsyncResponsesStream(_AsyncBaseStream):
    pass


class _ChatCompletionsAPI:
    def create(self, *, model: str, messages, stream: bool = False, **kwargs):
        _validate_message_list(messages)
        payload = {
            "type": "chat.completions.create",
            "model": model,
            "messages": messages,
            "stream": bool(stream)
        }
        payload.update(kwargs)

        result = _run_sync(_request(payload))
        if result.get("stream"):
            return ChatCompletionsStream(result["stream_id"])
        return _to_ns(result)


class _ChatAPI:
    def __init__(self):
        self.completions = _ChatCompletionsAPI()


class _ResponsesAPI:
    def create(
        self,
        *,
        model: str,
        input,
        instructions: str = None,
        stream: bool = False,
        previous_response_id: str = None,
        **kwargs,
    ):
        if isinstance(input, list):
            _validate_message_list(input)

        payload = {
            "type": "responses.create",
            "model": model,
            "input": input,
            "instructions": instructions,
            "stream": bool(stream),
            "previous_response_id": previous_response_id,
        }
        payload.update(kwargs)

        result = _run_sync(_request(payload))
        if result.get("stream"):
            return ResponsesStream(result["stream_id"])
        return _to_ns(result)


class _AsyncChatCompletionsAPI:
    async def create(self, *, model: str, messages, stream: bool = False, **kwargs):
        _validate_message_list(messages)
        payload = {
            "type": "chat.completions.create",
            "model": model,
            "messages": messages,
            "stream": bool(stream)
        }
        payload.update(kwargs)

        result = await _request(payload)
        if result.get("stream"):
            return AsyncChatCompletionsStream(result["stream_id"])
        return _to_ns(result)


class _AsyncChatAPI:
    def __init__(self):
        self.completions = _AsyncChatCompletionsAPI()


class _AsyncResponsesAPI:
    async def create(
        self,
        *,
        model: str,
        input,
        instructions: str = None,
        stream: bool = False,
        previous_response_id: str = None,
        **kwargs,
    ):
        if isinstance(input, list):
            _validate_message_list(input)

        payload = {
            "type": "responses.create",
            "model": model,
            "input": input,
            "instructions": instructions,
            "stream": bool(stream),
            "previous_response_id": previous_response_id,
        }
        payload.update(kwargs)

        result = await _request(payload)
        if result.get("stream"):
            return AsyncResponsesStream(result["stream_id"])
        return _to_ns(result)


class OpenAI:
    def __init__(self, *, base_url: str, api_key: str, **kwargs):
        if base_url != "https://localmodel":
            raise ValueError("base_url must be 'https://localmodel'")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError("api_key must be a non-empty string")

        self.base_url = base_url
        self.api_key = api_key
        self.options = kwargs
        self.chat = _ChatAPI()
        self.responses = _ResponsesAPI()


class AsyncOpenAI:
    def __init__(self, *, base_url: str, api_key: str, **kwargs):
        if base_url != "https://localmodel":
            raise ValueError("base_url must be 'https://localmodel'")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError("api_key must be a non-empty string")

        self.base_url = base_url
        self.api_key = api_key
        self.options = kwargs
        self.chat = _AsyncChatAPI()
        self.responses = _AsyncResponsesAPI()


__all__ = ["OpenAI", "AsyncOpenAI", "OpenAIError"]
