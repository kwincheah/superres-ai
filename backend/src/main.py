from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Annotated, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from supabase import Client, create_client

try:
    from .schemas import (
        ApiError,
        ApiErrorResponse,
        CreateUpscaleJobInput,
        CreateUpscaleJobResponse,
        GetUpscaleJobResponse,
        JobStatus,
        ModalUpscaleTaskPayload,
        UpscaleJob,
        UpscaleModel,
    )
except ImportError:  # pragma: no cover
    from schemas import (  # type: ignore
        ApiError,
        ApiErrorResponse,
        CreateUpscaleJobInput,
        CreateUpscaleJobResponse,
        GetUpscaleJobResponse,
        JobStatus,
        ModalUpscaleTaskPayload,
        UpscaleJob,
        UpscaleModel,
    )


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def get_env(name: str, *, required: bool = True, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    if value is None:
        return ""
    return value


def get_frontend_origins() -> list[str]:
    origins_value = os.getenv("FRONTEND_ORIGINS","https://superres-ai-flax.vercel.app")
    return [origin.strip() for origin in origins_value.split(",") if origin.strip()]


def make_error_response(status_code: int, code: str, message: str, details: Any | None = None) -> HTTPException:
    payload = ApiErrorResponse(error=ApiError(code=code, message=message, details=details))
    return HTTPException(status_code=status_code, detail=payload.model_dump(by_alias=True))


class AsyncSupabaseRepository:
    def __init__(self, client: Client, bucket: str, tasks_table: str) -> None:
        self._client = client
        self._bucket = bucket
        self._tasks_table = tasks_table

    async def upload_input_file(self, storage_path: str, content: bytes, content_type: str | None) -> None:
        def _upload() -> None:
            self._client.storage.from_(self._bucket).upload(
                path=storage_path,
                file=content,
                file_options={
                    "content-type": content_type or "application/octet-stream",
                    "upsert": "false",
                },
            )

        await asyncio.to_thread(_upload)

    async def insert_task(self, task_row: dict[str, Any]) -> dict[str, Any]:
        def _insert() -> dict[str, Any]:
            result = (
                self._client.table(self._tasks_table)
                .insert(task_row)
                .execute()
            )
            if not result.data:
                raise RuntimeError("Supabase insert returned empty data.")
            return result.data[0]

        return await asyncio.to_thread(_insert)

    async def get_task_by_id(self, job_id: str) -> dict[str, Any] | None:
        def _select() -> dict[str, Any] | None:
            result = (
                self._client.table(self._tasks_table)
                .select("*")
                .eq("id", job_id)
                .limit(1)
                .execute()
            )
            if not result.data:
                return None
            return result.data[0]

        return await asyncio.to_thread(_select)

    async def update_task(self, job_id: str, updates: dict[str, Any]) -> None:
        def _update() -> None:
            self._client.table(self._tasks_table).update(updates).eq("id", job_id).execute()

        await asyncio.to_thread(_update)


class ModalDispatcher:
    def __init__(self, endpoint: str | None, token: str | None) -> None:
        self._endpoint = endpoint
        self._token = token

    async def dispatch(self, payload: ModalUpscaleTaskPayload) -> None:
        if not self._endpoint:
            return

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._endpoint,
                json=payload.model_dump(by_alias=True),
                headers=headers,
            )
            response.raise_for_status()


SUPABASE_URL = get_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = get_env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = get_env("SUPABASE_STORAGE_BUCKET", required=False, default="images")
SUPABASE_TASKS_TABLE = get_env("SUPABASE_TASKS_TABLE", required=False, default="tasks")
DEFAULT_USER_ID = get_env("DEFAULT_USER_ID", required=False, default="00000000-0000-0000-0000-000000000000")
MODAL_DISPATCH_URL = get_env("MODAL_DISPATCH_URL", required=False, default=None)
MODAL_DISPATCH_TOKEN = get_env("MODAL_DISPATCH_TOKEN", required=False, default=None)

supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
repository = AsyncSupabaseRepository(
    client=supabase_client,
    bucket=SUPABASE_STORAGE_BUCKET,
    tasks_table=SUPABASE_TASKS_TABLE,
)
modal_dispatcher = ModalDispatcher(endpoint=MODAL_DISPATCH_URL, token=MODAL_DISPATCH_TOKEN)

app = FastAPI(title="AI Super-Resolution API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    payload = ApiErrorResponse(
        error=ApiError(code="http_error", message=str(exc.detail)),
    ).model_dump(by_alias=True)
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception) -> JSONResponse:
    payload = ApiErrorResponse(
        error=ApiError(code="internal_error", message="Internal server error.", details=str(exc)),
    ).model_dump(by_alias=True)
    return JSONResponse(status_code=500, content=payload)


def build_storage_paths(job_id: str, filename: str | None) -> tuple[str, str]:
    suffix = Path(filename or "").suffix.lower() or ".png"
    input_path = f"inputs/{job_id}{suffix}"
    output_path = f"outputs/{job_id}{suffix}"
    return input_path, output_path


def to_upscale_job(row: dict[str, Any]) -> UpscaleJob:
    job_payload = {
        "id": row["id"],
        "userId": row["user_id"],
        "status": row["status"],
        "inputPath": row["input_path"],
        "outputPath": row.get("output_path"),
        "model": row["model"],
        "scale": row["scale"],
        "faceEnhance": row["face_enhance"],
        "errorMessage": row.get("error_message"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "completedAt": row.get("completed_at"),
    }
    return UpscaleJob.model_validate(job_payload)


def resolve_user_id(x_user_id: str | None) -> str:
    if x_user_id is None:
        return DEFAULT_USER_ID

    try:
        return str(UUID(x_user_id))
    except ValueError as exc:
        raise make_error_response(400, "invalid_user_id", "x-user-id must be a valid UUID.") from exc


async def dispatch_modal_job(job_id: str, payload: ModalUpscaleTaskPayload) -> None:
    try:
        # Just trigger Modal. Modal will handle the 'processing' and 'completed' database updates itself.
        await modal_dispatcher.dispatch(payload)
        
    except Exception as exc:
        # Only intervene if the HTTP request to Modal completely fails
        await repository.update_task(
            job_id,
            {
                "status": JobStatus.FAILED.value,
                "error_message": str(exc),
                "updated_at": utcnow().isoformat(),
                "completed_at": utcnow().isoformat(),
            },
        )


@app.post("/api/v1/jobs", response_model=CreateUpscaleJobResponse, status_code=202)
async def create_job(
    file: UploadFile = File(...),
    model: Annotated[UpscaleModel, Form(...)] = UpscaleModel.REALESRGAN_X4PLUS,
    scale: Annotated[int, Form(...)] = 4,
    face_enhance: Annotated[bool, Form(alias="faceEnhance")] = False,
    x_user_id: Annotated[str | None, Header(alias="x-user-id")] = None,
) -> CreateUpscaleJobResponse:
    file_content = await file.read()
    if not file_content:
        raise make_error_response(400, "empty_file", "Uploaded file is empty.")

    job_id = str(uuid4())
    user_id = resolve_user_id(x_user_id)
    input_path, output_path = build_storage_paths(job_id, file.filename)

    create_input = CreateUpscaleJobInput(
        inputPath=input_path,
        outputPath=output_path,
        scale=scale,
        model=model,
        faceEnhance=face_enhance,
    )

    now_iso = utcnow().isoformat()

    await repository.upload_input_file(input_path, file_content, file.content_type)

    await repository.insert_task(
        {
            "id": job_id,
            "user_id": user_id,
            "status": JobStatus.QUEUED.value,
            "input_path": create_input.input_path,
            "output_path": create_input.output_path,
            "model": create_input.model.value,
            "scale": create_input.scale,
            "face_enhance": create_input.face_enhance,
            "error_message": None,
            "created_at": now_iso,
            "updated_at": now_iso,
            "completed_at": None,
        }
    )

    modal_payload = ModalUpscaleTaskPayload(
        jobId=job_id,
        inputPath=create_input.input_path,
        outputPath=create_input.output_path,
        model=create_input.model,
        scale=create_input.scale,
        faceEnhance=create_input.face_enhance,
    )

    asyncio.create_task(dispatch_modal_job(job_id, modal_payload))

    return CreateUpscaleJobResponse(jobId=job_id, status=JobStatus.QUEUED)


@app.get("/api/v1/jobs/{job_id}", response_model=GetUpscaleJobResponse)
async def get_job(job_id: str) -> GetUpscaleJobResponse:
    task_row = await repository.get_task_by_id(job_id)
    if task_row is None:
        raise make_error_response(404, "job_not_found", f"Job '{job_id}' was not found.")

    return GetUpscaleJobResponse(job=to_upscale_job(task_row))
