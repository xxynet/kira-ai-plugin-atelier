"""Atelier — a unified creative console for text, image, and voice.

Exposes a single plugin page plus a small set of API endpoints that wrap the
framework's already-configured default providers (LLM, image, TTS, STT). The
page itself is a static frontend served from ``./web``; every capability is
reached through the endpoints registered below.
"""

from core.plugin import BasePlugin, PluginPage, PageMenu, logger, register
from core.provider import LLMRequest
from core.agent.message import OpenAIMessage
from core.chat.message_elements import Record
from core.utils.common_utils import generate_image, text_to_speech, speech_to_text

DEFAULT_SYSTEM_PROMPT = (
    "You are a thoughtful creative collaborator inside KiraAI's Atelier. "
    "Answer with clarity and care, and prefer plain prose over heavy formatting."
)


class AtelierPlugin(BasePlugin):
    def __init__(self, ctx, cfg: dict):
        super().__init__(ctx, cfg)

    async def initialize(self):
        logger.info("[atelier] initialized")

    async def terminate(self):
        logger.info("[atelier] terminated")

    # ── Availability helper ────────────────────────────────────────────────

    def _provider_status(self) -> dict:
        """Report which default providers are actually configured."""
        status = {"llm": False, "image": False, "tts": False, "stt": False}

        try:
            if self.ctx.get_default_llm_client():
                status["llm"] = True
        except Exception:
            pass

        try:
            if self.ctx.provider_mgr.get_default_image():
                status["image"] = True
        except Exception:
            pass

        try:
            if self.ctx.provider_mgr.get_default_tts():
                status["tts"] = True
        except Exception:
            pass

        try:
            if self.ctx.provider_mgr.get_default_stt():
                status["stt"] = True
        except Exception:
            pass

        return status

    @register.api("GET", "/status")
    async def api_status(self):
        return {"ok": True, "available": self._provider_status()}

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

            client = self.ctx.get_default_llm_client()
            request = LLMRequest(messages=request_messages, tool_choice="none")
            response = await client.chat(request)
            return {"ok": True, "text": response.text_response or ""}
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

            client = self.ctx.provider_mgr.get_default_image()
            image = await generate_image(client, prompt)
            if not image:
                return {"ok": False, "error": "Image generation returned no result."}

            data_url = await image.to_data_url()
            return {"ok": True, "image": data_url, "mime": image.mime or "image/png"}
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

            client = self.ctx.provider_mgr.get_default_tts()
            record = await text_to_speech(client, text)
            if not record:
                return {"ok": False, "error": "Speech synthesis returned no result."}

            data_url = await record.to_data_url()
            return {"ok": True, "audio": data_url, "mime": record.mime or "audio/mpeg"}
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

            client = self.ctx.provider_mgr.get_default_stt()
            record = Record(record=audio)
            text = await speech_to_text(client, record)
            return {"ok": True, "text": text or ""}
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
