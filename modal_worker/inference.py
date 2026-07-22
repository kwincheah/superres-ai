from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Literal

import modal
import numpy as np
import torch

# --- MONKEYPATCH TO FIX BASICSr / TORCHVISION BUG ---
import torchvision.transforms.functional
sys.modules['torchvision.transforms.functional_tensor'] = torchvision.transforms.functional
# ----------------------------------------------------

from basicsr.archs.rrdbnet_arch import RRDBNet
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from realesrgan import RealESRGANer
from supabase import Client, create_client

APP_NAME = "ai-super-resolution-worker"
MODEL_DIR = Path("/models")

SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "images")
SUPABASE_TASKS_TABLE = os.getenv("SUPABASE_TASKS_TABLE", "tasks")

MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "realesrgan-x4plus": {
        "weights_url": (
            "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/"
            "RealESRGAN_x4plus.pth"
        ),
        "weights_file": "RealESRGAN_x4plus.pth",
        "num_block": 23,
    },
    "realesrgan-x4plus-anime": {
        "weights_url": (
            "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/"
            "RealESRGAN_x4plus_anime_6B.pth"
        ),
        "weights_file": "RealESRGAN_x4plus_anime_6B.pth",
        "num_block": 6,
    },
}

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch",
        "torchvision",
        "numpy",
    )
    .pip_install(
        "Pillow",
        "realesrgan",
        "supabase",
        "pydantic",
        "basicsr",
        "fastapi[standard]", 
    )
    .env({"PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True"})
)

app = modal.App(APP_NAME, image=image)
worker_secret = modal.Secret.from_name("ai-super-resolution-secrets")

def utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()

def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    
    # 1. Strip invisible spaces, newlines, and accidental quotes
    value = value.strip().strip('"').strip("'")
    
    # 2. If the secret was accidentally pasted as "KEY=VALUE", extract just the value
    if value.startswith(f"{name}="):
        value = value.split("=", 1)[1].strip().strip('"').strip("'")
        
    return value

class ModalUpscaleTaskPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    job_id: str = Field(alias="jobId")
    input_path: str = Field(alias="inputPath")
    output_path: str = Field(alias="outputPath")
    model: Literal["realesrgan-x4plus", "realesrgan-x4plus-anime"]
    scale: Literal[2, 4]
    face_enhance: bool = Field(alias="faceEnhance")

class ModalUpscaleTaskResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    job_id: str = Field(alias="jobId")
    output_path: str = Field(alias="outputPath")
    duration_ms: int = Field(alias="durationMs")

@app.cls(
    gpu="A10",
    timeout=600,
    scaledown_window=60,
    secrets=[worker_secret],
)
class ESRGANWorker:
    def __init__(self) -> None:
        self._models: dict[str, RealESRGANer] = {}

    @modal.enter()
    def load_models(self) -> None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        half_precision = device == "cuda"

        for model_name, config in MODEL_CONFIGS.items():
            weights_path = MODEL_DIR / config["weights_file"]

            if not weights_path.exists():
                torch.hub.download_url_to_file(config["weights_url"], str(weights_path))

            net = RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=config["num_block"],
                num_grow_ch=32,
                scale=4,
            )

            self._models[model_name] = RealESRGANer(
                scale=4,
                model_path=str(weights_path),
                model=net,
                tile=0,
                tile_pad=10,
                pre_pad=0,
                half=half_precision,
                gpu_id=0 if device == "cuda" else None,
            )

    def _create_supabase_client(self) -> Client:
        supabase_url = require_env("SUPABASE_URL")
        service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
        return create_client(supabase_url, service_role_key)

    @staticmethod
    def _update_task(
        client: Client,
        job_id: str,
        status: str,
        *,
        error_message: str | None = None,
        completed: bool = False,
    ) -> None:
        updates: dict[str, Any] = {
            "status": status,
            "updated_at": utcnow_iso(),
        }
        if completed:
            updates["completed_at"] = utcnow_iso()
        if error_message is not None:
            updates["error_message"] = error_message[:2000]
        elif status == "completed":
            updates["error_message"] = None

        client.table(SUPABASE_TASKS_TABLE).update(updates).eq("id", job_id).execute()

    @staticmethod
    def _download_input_image(client: Client, path: str) -> Image.Image:
        image_bytes = client.storage.from_(SUPABASE_STORAGE_BUCKET).download(path)
        if not image_bytes:
            raise RuntimeError(f"Input image not found in storage: {path}")
        return Image.open(BytesIO(image_bytes)).convert("RGB")

    @staticmethod
    def _upload_output_image(client: Client, path: str, output_image: Image.Image) -> None:
        buffer = BytesIO()
        output_image.save(buffer, format="PNG")
        buffer.seek(0)

        client.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=path,
            file=buffer.getvalue(),
            file_options={"content-type": "image/png", "upsert": "true"},
        )

    def _run_inference(self, payload: ModalUpscaleTaskPayload, source_image: Image.Image) -> Image.Image:
        if payload.model not in self._models:
            raise RuntimeError(f"Unsupported model: {payload.model}")

        model = self._models[payload.model]

        # Force PyTorch to release unallocated reserved VRAM
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        input_array = np.array(source_image, dtype=np.uint8)
        output_array, _ = model.enhance(input_array, outscale=4)

        output_image = Image.fromarray(output_array)

        if payload.scale == 2:
            output_image = output_image.resize(
                (source_image.width * 2, source_image.height * 2),
                resample=Image.Resampling.LANCZOS,
            )

        return output_image

    @modal.fastapi_endpoint(method="POST")
    def enhance(self, payload: dict[str, Any]) -> dict[str, Any]:
        start_time = time.perf_counter()
        job_id_for_error: str | None = None
        client: Client | None = None

        try:
            request = ModalUpscaleTaskPayload.model_validate(payload)
            job_id_for_error = request.job_id

            client = self._create_supabase_client()
            self._update_task(client, request.job_id, "processing")

            input_image = self._download_input_image(client, request.input_path)
            output_image = self._run_inference(request, input_image)
            self._upload_output_image(client, request.output_path, output_image)

            self._update_task(client, request.job_id, "completed", completed=True)

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            result = ModalUpscaleTaskResult(
                jobId=request.job_id,
                outputPath=request.output_path,
                durationMs=duration_ms,
            )
            return result.model_dump(by_alias=True)
        except ValidationError as exc:
            if client is None:
                client = self._create_supabase_client()
            if job_id_for_error:
                self._update_task(
                    client,
                    job_id_for_error,
                    "failed",
                    error_message=f"Payload validation failed: {exc}",
                    completed=True,
                )
            raise
        except Exception as exc:
            if client is None:
                client = self._create_supabase_client()
            if job_id_for_error:
                self._update_task(
                    client,
                    job_id_for_error,
                    "failed",
                    error_message=str(exc),
                    completed=True,
                )
            raise