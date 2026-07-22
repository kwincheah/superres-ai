export type UUID = string;
export type ISODateString = string;

export const UPSCALE_MODELS = ["realesrgan-x4plus", "realesrgan-x4plus-anime"] as const;
export type UpscaleModel = (typeof UPSCALE_MODELS)[number];

export const JOB_STATUSES = ["queued", "processing", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface CreateUpscaleJobInput {
  inputPath: string;
  outputPath: string;
  scale: 2 | 4;
  model: UpscaleModel;
  faceEnhance: boolean;
}

export interface UpscaleJob {
  id: UUID;
  userId: UUID;
  status: JobStatus;
  inputPath: string;
  outputPath: string | null;
  model: UpscaleModel;
  scale: 2 | 4;
  faceEnhance: boolean;
  errorMessage: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  completedAt: ISODateString | null;
}

export interface CreateUpscaleJobResponse {
  jobId: UUID;
  status: Extract<JobStatus, "queued" | "processing">;
}

export interface GetUpscaleJobResponse {
  job: UpscaleJob;
}

export interface ListUpscaleJobsResponse {
  jobs: UpscaleJob[];
}

export interface ModalUpscaleTaskPayload {
  jobId: UUID;
  inputPath: string;
  outputPath: string;
  model: UpscaleModel;
  scale: 2 | 4;
  faceEnhance: boolean;
}

export interface ModalUpscaleTaskResult {
  jobId: UUID;
  outputPath: string;
  durationMs: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export type ApiResponse<T> = T | ApiErrorResponse;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];