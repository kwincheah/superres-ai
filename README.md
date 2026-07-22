# SuperResAI

SuperResAI is a production-oriented image enhancement platform that lets users upload low-resolution images and receive AI-upscaled results asynchronously through a GPU-powered processing pipeline.

## Overview

SuperResAI combines a Next.js frontend, a FastAPI backend, and a Modal-hosted Real-ESRGAN worker to deliver a seamless upload-to-results experience. Jobs are tracked in Supabase Postgres and assets are stored in Supabase Storage, allowing the UI to poll for completion without blocking the user experience.

## Key Features

- Asynchronous image upscaling with queued job processing
- GPU inference on Modal using Real-ESRGAN
- Interactive before/after comparison experience
- Type-safe contracts between frontend, backend, and worker
- Persistent job tracking and artifact storage with Supabase

## Architecture

- Frontend: Next.js 15+ (App Router), TypeScript, Tailwind CSS, Shadcn UI, Lucide React
- Backend: FastAPI, Pydantic v2, async Supabase client
- Inference Worker: Modal + PyTorch + Real-ESRGAN
- Data Layer: Supabase Postgres, Storage, and task tracking

## Project Structure

```text
frontend/      # Next.js application
backend/       # FastAPI API service
modal_worker/  # Modal GPU worker
```

## Prerequisites

- Node.js 20 or newer
- Python 3.11+
- A Supabase project
- A Modal account and CLI access

## Environment Configuration

### Frontend

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend

Set the following environment variables for the FastAPI service:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=images
SUPABASE_TASKS_TABLE=tasks
FRONTEND_ORIGINS=http://localhost:3000
MODAL_DISPATCH_URL=your-modal-endpoint-url
MODAL_DISPATCH_TOKEN=your-modal-token
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000
```

### Modal Worker

Create a Modal secret named `ai-super-resolution-secrets` with:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=images
SUPABASE_TASKS_TABLE=tasks
```

## Supabase Setup

1. Create a storage bucket named `images`.
2. Create a table named `tasks` with the following fields:
   - `id` (text, primary key)
   - `user_id` (text)
   - `status` (text)
   - `input_path` (text)
   - `output_path` (text)
   - `model` (text)
   - `scale` (integer)
   - `face_enhance` (boolean)
   - `error_message` (text)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)
   - `completed_at` (timestamp)

## Getting Started

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Modal Worker

```bash
cd modal_worker
modal deploy inference.py
```

## API Endpoints

- `POST /api/v1/jobs` — upload an image and create a new enhancement job
- `GET /api/v1/jobs/{job_id}` — poll job status and output metadata

## Development Notes

- Configure real credentials before running the full end-to-end flow.
- The worker updates the `tasks` table as jobs move through `queued → processing → completed/failed`.
