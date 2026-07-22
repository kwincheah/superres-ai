from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class UpscaleModel(StrEnum):
    REALESRGAN_X4PLUS = "realesrgan-x4plus"
    REALESRGAN_X4PLUS_ANIME = "realesrgan-x4plus-anime"


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CreateUpscaleJobInput(APIModel):
    input_path: str = Field(alias="inputPath")
    output_path: str = Field(alias="outputPath")
    scale: Literal[2, 4]
    model: UpscaleModel
    face_enhance: bool = Field(alias="faceEnhance")


class UpscaleJob(APIModel):
    id: str
    user_id: str = Field(alias="userId")
    status: JobStatus
    input_path: str = Field(alias="inputPath")
    output_path: str | None = Field(alias="outputPath")
    model: UpscaleModel
    scale: Literal[2, 4]
    face_enhance: bool = Field(alias="faceEnhance")
    error_message: str | None = Field(alias="errorMessage")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    completed_at: datetime | None = Field(alias="completedAt")


class CreateUpscaleJobResponse(APIModel):
    job_id: str = Field(alias="jobId")
    status: Literal[JobStatus.QUEUED, JobStatus.PROCESSING]


class GetUpscaleJobResponse(APIModel):
    job: UpscaleJob


class ListUpscaleJobsResponse(APIModel):
    jobs: list[UpscaleJob]


class ModalUpscaleTaskPayload(APIModel):
    job_id: str = Field(alias="jobId")
    input_path: str = Field(alias="inputPath")
    output_path: str = Field(alias="outputPath")
    model: UpscaleModel
    scale: Literal[2, 4]
    face_enhance: bool = Field(alias="faceEnhance")


class ModalUpscaleTaskResult(APIModel):
    job_id: str = Field(alias="jobId")
    output_path: str = Field(alias="outputPath")
    duration_ms: int = Field(alias="durationMs")


class ApiError(APIModel):
    code: str
    message: str
    details: Any | None = None


class ApiErrorResponse(APIModel):
    error: ApiError