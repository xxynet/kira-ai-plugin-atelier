"""Atelier — a unified creative console for text, image, and voice.

Exposes a single plugin page plus a small set of API endpoints that wrap the
framework's configured providers (LLM, image, TTS, STT). Every capability uses
the framework default unless a different model was selected on the plugin page;
the selection is stored in the plugin's own runtime data directory.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from core.agent.message import OpenAIMessage
from core.chat.message_elements import Record
from core.plugin import BasePlugin, PageMenu, PluginPage, logger, register
from core.provider import LLMRequest, ModelType
from core.provider.provider import (
    ImageModelClient,
    LLMModelClient,
    STTModelClient,
    TTSModelClient,
)
from core.utils.common_utils import generate_image, speech_to_text, text_to_speech

DEFAULT_SYSTEM_PROMPT = (
    "You are a thoughtful creative collaborator inside KiraAI's Atelier. "
    "Answer with clarity and care, and prefer plain prose over heavy formatting."
)

# One entry per capability exposed by the page. ``default_getter`` names the
# ProviderManager method that resolves the framework default for that type.
CAPABILITIES = {
    "llm": {
        "default_key": "default_llm",
        "model_type": ModelType.LLM,
        "client_cls": LLMModelClient,
        "default_getter": None,
    },
    "image": {
        "default_key": "default_image",
        "model_type": ModelType.IMAGE,
        "client_cls": ImageModelClient,
        "default_getter": "get_default_image",
    },
    "tts": {
        "default_key": "default_tts",
        "model_type": ModelType.TTS,
        "client_cls": TTSModelClient,
        "default_getter": "get_default_tts",
    },
    "stt": {
        "default_key": "default_stt",
        "model_type": ModelType.STT,
        "client_cls": STTModelClient,
        "default_getter": "get_default_stt",
    },
}

SELECTION_FILE = "models.json"


class AtelierPlugin(BasePlugin):
    def __init__(self, ctx, cfg: dict):
        super().__init__(ctx, cfg)
        self._selection: dict[str, str] | None = None

    async def initialize(self):
        logger.info("[atelier] initialized")

    async def terminate(self):
        logger.info("[atelier] terminated")

    # ── Selection storage ──────────────────────────────────────────────────

    def _selection_path(self) -> Path | None:
        """Resolve the per-plugin file holding the selected model references."""
        try:
            base_dir = self.ctx.get_plugin_data_dir()
        except Exception:
            return None
        return base_dir / SELECTION_FILE if base_dir else None

    def _load_selection(self) -> dict[str, str]:
        if self._selection is not None:
            return self._selection

        selection = {capability: "" for capability in CAPABILITIES}
        path = self._selection_path()
        if path and path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except Exception as error:
                logger.warning(f"[atelier] failed to read model selection: {error}")
                raw = {}
            saved = raw.get("models") if isinstance(raw, dict) else None
            if isinstance(saved, dict):
                for capability in CAPABILITIES:
                    value = saved.get(capability)
                    if isinstance(value, str):
                        selection[capability] = value.strip()

        self._selection = selection
        return selection

    def _save_selection(self, selection: dict[str, str]) -> None:
        # Keep the in-memory copy authoritative even when no data dir exists.
        self._selection = dict(selection)
        path = self._selection_path()
        if not path:
            return
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(f".{path.name}.tmp")
            temporary.write_text(
                json.dumps({"models": selection}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            os.replace(temporary, path)
        except Exception as error:
            logger.error(f"[atelier] failed to save model selection: {error}")

    # ── Model resolution ───────────────────────────────────────────────────

    def _default_reference(self, capability: str) -> str:
        """Read the framework default model reference for one capability."""
        key = CAPABILITIES[capability]["default_key"]
        try:
            value = self.ctx.config.get_config(f"models.{key}")
        except Exception:
            return ""
        return value.strip() if isinstance(value, str) else ""

    def _default_client(self, capability: str):
        meta = CAPABILITIES[capability]
        if capability == "llm":
            return self.ctx.get_default_llm_client()
        return getattr(self.ctx.provider_mgr, meta["default_getter"])()

    def _client_for(self, capability: str, reference: str | None = None):
        """Resolve a client for one capability.

        A per-request reference wins over the stored selection; an unset,
        malformed, or no-longer-available selection falls back to the framework
        default so the page keeps working after models are reconfigured.
        """
        meta = CAPABILITIES[capability]
        requested = reference.strip() if isinstance(reference, str) else ""
        if not requested:
            requested = self._load_selection().get(capability, "")

        if requested:
            provider_id, separator, model_id = requested.partition(":")
            if separator and provider_id and model_id:
                client = None
                try:
                    client = self.ctx.provider_mgr.get_model_client(
                        provider_id, model_id, meta["model_type"],
                    )
                except Exception as error:
                    logger.warning(
                        f"[atelier] {capability} model {requested} unavailable: {error}"
                    )
                if client is not None and not isinstance(client, meta["client_cls"]):
                    logger.warning(
                        f"[atelier] {capability} model {requested} has an unexpected client type"
                    )
                    client = None
                if client is not None:
                    return client
            else:
                logger.warning(f"[atelier] malformed {capability} model reference: {requested}")

        return self._default_client(capability)

    @staticmethod
    def _model_info(client) -> dict:
        model = getattr(client, "model", None)
        provider_id = getattr(model, "provider_id", "") or ""
        model_id = getattr(model, "model_id", "") or ""
        return {
            "provider": getattr(model, "provider_name", "") or "",
            "model": getattr(model, "model_name", "") or "",
            "reference": f"{provider_id}:{model_id}" if provider_id and model_id else "",
        }

    def _provider_status(self) -> dict:
        """Report which capabilities can actually be served right now."""
        status = {}
        for capability in CAPABILITIES:
            try:
                status[capability] = self._client_for(capability) is not None
            except Exception:
                status[capability] = False
        return status

    def _catalog(self) -> dict:
        """List the configured models available for each capability."""
        catalog = {}
        providers = self.ctx.config.get("providers", {}) or {}

        for capability, meta in CAPABILITIES.items():
            default_ref = self._default_reference(capability)
            models = []
            for provider_id, provider_cfg in providers.items():
                if not isinstance(provider_cfg, dict):
                    continue
                if provider_cfg.get("status", "active") != "active":
                    continue
                try:
                    infos = self.ctx.provider_mgr.get_model_infos(provider_id)
                except Exception as error:
                    logger.warning(
                        f"[atelier] failed to list models of {provider_id}: {error}"
                    )
                    continue
                for info in infos:
                    if info.model_type != meta["model_type"]:
                        continue
                    reference = f"{info.provider_id}:{info.model_id}"
                    models.append({
                        "reference": reference,
                        "provider": info.provider_name,
                        "model": info.model_name,
                        "is_default": reference == default_ref,
                    })

            models.sort(key=lambda item: (item["provider"].lower(), item["model"].lower()))
            default_model = next((item for item in models if item["is_default"]), None)
            catalog[capability] = {
                "models": models,
                "default": {
                    "reference": default_ref,
                    "provider": default_model["provider"] if default_model else "",
                    "model": default_model["model"] if default_model else "",
                    "configured": bool(default_ref),
                },
            }

        return catalog

    # ── Status & selection endpoints ───────────────────────────────────────

    @register.api("GET", "/status")
    async def api_status(self):
        return {
            "ok": True,
            "available": self._provider_status(),
            "selection": dict(self._load_selection()),
            "catalog": self._catalog(),
        }

    @register.api("POST", "/selection")
    async def api_selection(self, payload: dict):
        try:
            updates = payload.get("models") if isinstance(payload, dict) else None
            if not isinstance(updates, dict):
                updates = {
                    (payload or {}).get("capability"): (payload or {}).get("reference", ""),
                }

            current = dict(self._load_selection())
            catalog = self._catalog()
            changed = False

            for capability, reference in updates.items():
                if capability not in CAPABILITIES:
                    continue
                value = reference.strip() if isinstance(reference, str) else ""
                if value:
                    known = {item["reference"] for item in catalog[capability]["models"]}
                    if value not in known:
                        return {
                            "ok": False,
                            "error": f"Unknown {capability} model: {value}",
                        }
                current[capability] = value
                changed = True

            if changed:
                self._save_selection(current)

            return {
                "ok": True,
                "available": self._provider_status(),
                "selection": current,
                "catalog": catalog,
            }
        except Exception as e:
            logger.error(f"[atelier] selection error: {e}")
            return {"ok": False, "error": str(e)}

    # ── Text (LLM) ─────────────────────────────────────────────────────────

    @register.api("POST", "/chat")
    async def api_chat(self, payload: dict):
        try:
            raw_messages = payload.get("messages") or []
            messages = []
            for item in raw_messages:
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                content = item.get("content")
                if role in ("user", "assistant") and isinstance(content, str) and content.strip():
                    messages.append(OpenAIMessage(role=role, content=content))

            if not any(m.role == "user" for m in messages):
                return {"ok": False, "error": "No user message provided."}

            system_text = (self.plugin_cfg.get("system_prompt") or "").strip() or DEFAULT_SYSTEM_PROMPT
            request_messages = [OpenAIMessage(role="system", content=system_text)] + messages

            client = self._client_for("llm", payload.get("model"))
            request = LLMRequest(messages=request_messages, tool_choice="none")
            response = await client.chat(request)
            return {
                "ok": True,
                "text": response.text_response or "",
                "model": self._model_info(client),
            }
        except Exception as e:
            logger.error(f"[atelier] chat error: {e}")
            return {"ok": False, "error": str(e)}

    # ── Image generation ───────────────────────────────────────────────────

    @register.api("POST", "/image")
    async def api_image(self, payload: dict):
        try:
            prompt = (payload.get("prompt") or "").strip()
            if not prompt:
                return {"ok": False, "error": "Prompt is empty."}

            client = self._client_for("image", payload.get("model"))
            image = await generate_image(client, prompt)
            if not image:
                return {"ok": False, "error": "Image generation returned no result."}

            data_url = await image.to_data_url()
            return {
                "ok": True,
                "image": data_url,
                "mime": image.mime or "image/png",
                "name": image.guess_name() or "",
                "model": self._model_info(client),
            }
        except Exception as e:
            logger.error(f"[atelier] image error: {e}")
            return {"ok": False, "error": str(e)}

    # ── Text-to-speech ─────────────────────────────────────────────────────

    @register.api("POST", "/tts")
    async def api_tts(self, payload: dict):
        try:
            text = (payload.get("text") or "").strip()
            if not text:
                return {"ok": False, "error": "Text is empty."}

            client = self._client_for("tts", payload.get("model"))
            record = await text_to_speech(client, text)
            if not record:
                return {"ok": False, "error": "Speech synthesis returned no result."}

            data_url = await record.to_data_url()
            return {
                "ok": True,
                "audio": data_url,
                "mime": record.mime or "audio/mpeg",
                "name": record.guess_name() or "",
                "model": self._model_info(client),
            }
        except Exception as e:
            logger.error(f"[atelier] tts error: {e}")
            return {"ok": False, "error": str(e)}

    # ── Speech-to-text ─────────────────────────────────────────────────────

    @register.api("POST", "/stt")
    async def api_stt(self, payload: dict):
        try:
            audio = (payload.get("audio") or "").strip()
            if not audio:
                return {"ok": False, "error": "No audio received."}

            if not audio.startswith("data:"):
                audio = f"data:audio/webm;base64,{audio}"

            client = self._client_for("stt", payload.get("model"))
            record = Record(record=audio)
            text = await speech_to_text(client, record)
            return {
                "ok": True,
                "text": text or "",
                "model": self._model_info(client),
            }
        except Exception as e:
            logger.error(f"[atelier] stt error: {e}")
            return {"ok": False, "error": str(e)}

    # ── Web UI page ────────────────────────────────────────────────────────

    @register.page(
        "/atelier",
        auth=True,
        menu=PageMenu(
            label={"zh": "创作工坊", "en": "Atelier"},
            icon="MagicStick",
            order=30,
        ),
    )
    def page_atelier(self):
        return PluginPage.from_folder("./web")
