"""
MuAPI Video Generation Tool

Drop-in replacement for FalVideoGenerationTool. Uses the MuAPI REST API
(api.muapi.ai) for text-to-video, image-to-video, and image-to-image.

Same public surface as FalVideoGenerationTool (text_to_video, image_to_video,
image_to_image) so existing agent code keeps working.

Set MUAPI_API_KEY in the environment. The model_name field accepts MuAPI
model IDs (e.g. 'ltx-2-fast', 'kling-1.6-pro', 'gpt-image-1.5').
"""

import os
import time
import requests
from typing import Optional


# Map legacy fal-* model names to MuAPI equivalents. This keeps existing
# director agent config working while the underlying engine is swapped.
FAL_TO_MUAPI = {
    # text-to-video
    "fal-ai/minimax-video": "minimax-video-01",
    "fal-ai/mochi-v1": "mochi-v1",
    "fal-ai/hunyuan-video": "hunyuan-video",
    "fal-ai/luma-dream-machine": "luma-dream-machine",
    "fal-ai/kling-video/v1/standard/text-to-video": "kling-1.0-standard",
    "fal-ai/kling-video/v1.5/pro/text-to-video": "kling-1.6-pro",
    "fal-ai/cogvideox-5b": "cogvideox-5b",
    "fal-ai/ltx-video": "ltx-2-fast",
    "fal-ai/fast-svd/text-to-video": "svd-fast",
    "fal-ai/fast-svd-lcm/text-to-video": "svd-lcm",
    "fal-ai/t2v-turbo": "t2v-turbo",
    "fal-ai/fast-animatediff/text-to-video": "animatediff",
    "fal-ai/fast-animatediff/turbo/text-to-video": "animatediff-turbo",
    # image-to-video
    "fal-ai/haiper-video/v2/image-to-video": "haiper-v2",
    "fal-ai/luma-dream-machine/image-to-video": "luma-i2v",
    "fal-ai/cogvideox-5b/image-to-video": "cogvideox-5b-i2v",
    "fal-ai/ltx-video/image-to-video": "ltx-2-fast",
    "fal-ai/stable-video": "stable-video",
    "fal-ai/fast-svd-lcm": "svd-lcm",
    # image-to-image
    "fal-ai/flux-pro/v1.1-ultra/redux": "flux-pro-1.1-ultra",
    "fal-ai/flux-lora-canny": "flux-lora-canny",
    "fal-ai/flux-lora-depth": "flux-lora-depth",
    "fal-ai/ideogram/v2/turbo/remix": "ideogram-v2-turbo",
    "fal-ai/iclight-v2": "iclight-v2",
}


PARAMS_CONFIG = {
    "text_to_video": {
        "model_name": {
            "type": "string",
            "description": "MuAPI model name for text-to-video generation",
            "default": "ltx-2-fast",
            "enum": [
                "ltx-2-fast",
                "kling-1.6-pro",
                "kling-1.0-standard",
                "minimax-video-01",
                "hunyuan-video",
                "cogvideox-5b",
                "luma-dream-machine",
                "mochi-v1",
                "svd-fast",
                "svd-lcm",
                "t2v-turbo",
                "animatediff",
                "animatediff-turbo",
            ],
        },
    },
    "image_to_video": {
        "model_name": {
            "type": "string",
            "description": "MuAPI model name for image-to-video generation",
            "default": "ltx-2-fast",
            "enum": [
                "ltx-2-fast",
                "kling-1.6-pro",
                "haiper-v2",
                "luma-i2v",
                "cogvideox-5b-i2v",
                "stable-video",
                "svd-lcm",
            ],
        },
    },
    "image_to_image": {
        "model_name": {
            "type": "string",
            "description": "MuAPI model name for image-to-image transformation",
            "default": "flux-pro-1.1-ultra",
            "enum": [
                "flux-pro-1.1-ultra",
                "flux-lora-canny",
                "flux-lora-depth",
                "ideogram-v2-turbo",
                "iclight-v2",
                "gpt-image-1.5",
            ],
        },
    },
}


def _resolve_model(model_name: str) -> str:
    """Translate fal-* identifiers to MuAPI models. Pass-through if unknown."""
    return FAL_TO_MUAPI.get(model_name, model_name)


class MuapiVideoGenerationTool:
    """Drop-in replacement for FalVideoGenerationTool backed by MuAPI."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("MUAPI_API_KEY") or os.getenv("VITE_MUAPI_KEY")
        if not self.api_key:
            raise Exception("MUAPI_API_KEY not found in environment")
        self.base = (os.getenv("MUAPI_BASE_URL") or "https://api.muapi.ai/api/v1").rstrip("/")
        self.polling_interval = float(os.getenv("MUAPI_POLL_INTERVAL", "4"))
        self.max_poll_seconds = float(os.getenv("MUAPI_MAX_POLL_SECONDS", "600"))

    def _headers(self):
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
        }

    def _submit(self, endpoint: str, payload: dict) -> str:
        """POST to /<endpoint>, return request_id (MuAPI async pattern)."""
        url = f"{self.base}/{endpoint.lstrip('/')}"
        r = requests.post(url, json=payload, headers=self._headers(), timeout=60)
        if r.status_code not in (200, 201, 202):
            raise Exception(
                f"MuAPI {endpoint} submit failed: {r.status_code} {r.text[:300]}"
            )
        data = r.json()
        return data.get("request_id") or data.get("id") or data.get("task_id")

    def _poll(self, endpoint: str, request_id: str) -> dict:
        """Poll until completion. Returns the final response payload."""
        url = f"{self.base}/{endpoint.lstrip('/')}/{request_id}"
        deadline = time.time() + self.max_poll_seconds
        while time.time() < deadline:
            r = requests.get(url, headers=self._headers(), timeout=30)
            if r.status_code == 200:
                data = r.json()
                status = (data.get("status") or "").lower()
                if status in ("completed", "succeeded", "success", "done"):
                    return data
                if status in ("failed", "error", "canceled", "cancelled"):
                    raise Exception(f"MuAPI {endpoint} failed: {data}")
            time.sleep(self.polling_interval)
        raise Exception(f"MuAPI {endpoint} timed out after {self.max_poll_seconds}s")

    def _extract_url(self, data: dict) -> Optional[str]:
        for key in ("url", "video_url", "output_url", "image_url"):
            if data.get(key):
                return data[key]
        # MuAPI sometimes nests the artifact under "output" or "result"
        for nested in ("output", "result", "data"):
            obj = data.get(nested)
            if isinstance(obj, dict):
                u = self._extract_url(obj)
                if u:
                    return u
            elif isinstance(obj, list) and obj:
                first = obj[0]
                if isinstance(first, dict):
                    u = self._extract_url(first)
                    if u:
                        return u
                elif isinstance(first, str):
                    return first
        return None

    def _download(self, url: str, save_at: str):
        r = requests.get(url, timeout=120, stream=True)
        r.raise_for_status()
        with open(save_at, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)

    def text_to_video(self, prompt: str, save_at: str, duration: float, config: dict):
        """Generate a video from text via MuAPI."""
        try:
            model = _resolve_model(config.get("model_name", "ltx-2-fast"))
            request_id = self._submit(
                "videos/generate",
                {
                    "model": model,
                    "prompt": prompt,
                    "duration": int(duration) if duration else 5,
                },
            )
            if not request_id:
                raise Exception("MuAPI did not return a request_id")
            result = self._poll("videos/generate", request_id)
            url = self._extract_url(result)
            if not url:
                raise Exception(f"No video URL in response: {str(result)[:300]}")
            self._download(url, save_at)
        except Exception as e:
            raise Exception(
                f"Error generating video: {type(e).__name__}: {str(e)}"
            )
        return {"status": "success", "video_path": save_at}

    def image_to_video(
        self,
        image_url: str,
        save_at: str,
        duration: float,
        config: dict,
        prompt: Optional[str] = None,
    ):
        """Generate video from an image URL via MuAPI."""
        try:
            model = _resolve_model(config.get("model_name", "ltx-2-fast"))
            arguments = {
                "model": model,
                "image_url": image_url,
                "duration": int(duration) if duration else 5,
            }
            if prompt:
                arguments["prompt"] = prompt
            request_id = self._submit("videos/generate", arguments)
            if not request_id:
                raise Exception("MuAPI did not return a request_id")
            result = self._poll("videos/generate", request_id)
            url = self._extract_url(result)
            if not url:
                raise Exception(f"No video URL in response: {str(result)[:300]}")
            self._download(url, save_at)
        except Exception as e:
            raise Exception(
                f"Error generating video: {type(e).__name__}: {str(e)}"
            )

    def image_to_image(self, image_url: str, prompt: str, config: dict):
        """Transform an image with a text prompt via MuAPI."""
        try:
            model = _resolve_model(config.get("model_name", "flux-pro-1.1-ultra"))
            request_id = self._submit(
                "images/generate",
                {
                    "model": model,
                    "prompt": prompt,
                    "image_url": image_url,
                },
            )
            if not request_id:
                raise Exception("MuAPI did not return a request_id")
            result = self._poll("images/generate", request_id)
            images = result.get("images") or result.get("output") or []
            if isinstance(images, list) and images:
                return images
            url = self._extract_url(result)
            if url:
                return [{"url": url}]
            raise Exception(f"No image URL in response: {str(result)[:300]}")
        except Exception as e:
            raise Exception(
                f"Error generating image: {type(e).__name__}: {str(e)}"
            )


# Backward-compatible alias so existing imports of FalVideoGenerationTool
# continue to work after the swap. The class is now backed by MuAPI.
FalVideoGenerationTool = MuapiVideoGenerationTool
