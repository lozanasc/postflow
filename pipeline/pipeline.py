"""
Main pipeline orchestrator.

Exposes a FastAPI ASGI app with:
  POST /ingest   — start a processing job, returns job_id
  WS   /progress — real-time progress updates for a job_id

Flow: download → upload source → transcribe → silence removal → highlight extraction → render clips
"""
import modal
from pipeline.common import app, wasabi_secret, hf_secret
from pipeline.transcribe import Transcriber, transcription_image
from pipeline.silence import silence_image
from pipeline.llm import HighlightExtractor, llm_image
from pipeline.render import render_clip, render_postcut, render_image

pipeline_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "curl")
    .pip_install("fastapi[standard]", "boto3", "yt-dlp", "python-multipart", "numpy")
)

# ── ASGI web app (FastAPI) ─────────────────────────────────────────────────────

@app.function(image=pipeline_image, secrets=[wasabi_secret], timeout=3600)
@modal.asgi_app()
def web():
    import asyncio
    import json
    import uuid
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    api = FastAPI(title="Postflow Pipeline")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class IngestRequest(BaseModel):
        video_url: str | None = None
        youtube_url: str | None = None
        language: str | None = None
        db_job_id: str | None = None
        webhook_url: str | None = None

    @api.post("/ingest")
    async def ingest(req: IngestRequest):
        job_id = str(uuid.uuid4())
        run_pipeline.spawn(
            job_id=job_id,
            video_url=req.video_url,
            youtube_url=req.youtube_url,
            language=req.language,
            db_job_id=req.db_job_id,
            webhook_url=req.webhook_url,
        )
        return {"job_id": job_id, "status": "queued"}

    @api.websocket("/progress/{job_id}")
    async def progress(websocket: WebSocket, job_id: str):
        await websocket.accept()
        try:
            job_dict = modal.Dict.from_name(f"job-{job_id}", create_if_missing=True)
            while True:
                status = job_dict.get("status", "queued")
                payload = {
                    "job_id": job_id,
                    "status": status,
                    "step": job_dict.get("step", ""),
                    "progress": job_dict.get("progress", 0),
                    "error": job_dict.get("error"),
                    "result": job_dict.get("result"),
                }
                await websocket.send_text(json.dumps(payload))
                if status in ("completed", "failed"):
                    break
                await asyncio.sleep(2)
        except WebSocketDisconnect:
            pass

    return api


# ── Background pipeline function ───────────────────────────────────────────────

@app.function(
    image=pipeline_image,
    secrets=[wasabi_secret, hf_secret],
    timeout=7200,
    cpu=4,
    memory=16384,
)
def run_pipeline(
    job_id: str,
    video_url: str | None = None,
    youtube_url: str | None = None,
    language: str | None = None,
    db_job_id: str | None = None,
    webhook_url: str | None = None,
) -> dict:
    import os
    import tempfile
    import boto3
    import urllib.request

    def update(step: str, progress: int, status: str = "running"):
        if webhook_url:
            try:
                payload = f'{{"status":"{status}","step":"{step}","progress":{progress}}}'
                req = urllib.request.Request(
                    webhook_url,
                    data=payload.encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, "input.mp4")
            audio_path = os.path.join(tmpdir, "audio.wav")

            # ── Step 1: Download video ────────────────────────────────────────
            update("Downloading video", 5)
            if youtube_url:
                _download_youtube(youtube_url, video_path)
            elif video_url:
                _download_from_wasabi(video_url, video_path)
            else:
                raise ValueError("Either video_url or youtube_url is required.")

            # ── Step 2: Upload source to Wasabi (needed by remote functions) ──
            update("Uploading source video", 10)
            source_key = f"jobs/{job_id}/source.mp4"
            _upload_to_wasabi(video_path, source_key)

            # ── Step 3: Extract audio ─────────────────────────────────────────
            update("Extracting audio", 15)
            _extract_audio(video_path, audio_path)

            # ── Step 4: Transcribe (pass audio bytes — remote container) ──────
            update("Transcribing audio", 20)
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            transcriber = Transcriber()
            transcript = transcriber.run.remote(audio_bytes, language=language)

            # ── Step 5: Remove silence (remote downloads from Wasabi) ─────────
            update("Removing silence", 55)
            from pipeline.silence import remove_silence
            postcut_key = f"jobs/{job_id}/postcut.mp4"
            silence_result = remove_silence.remote(
                input_wasabi_key=source_key,
                output_key=postcut_key,
            )

            # ── Step 6: Extract highlights ────────────────────────────────────
            update("Extracting highlights", 70)
            extractor = HighlightExtractor()
            clips = extractor.extract.remote(transcript["word_segments"])

            # ── Step 7: Render clips in parallel ──────────────────────────────
            update("Rendering vertical clips", 80)
            top_clips = sorted(clips, key=lambda c: c["virality_score"], reverse=True)[:10]
            rendered_clips = list(render_clip.starmap([
                (job_id, i, clip, source_key, transcript["word_segments"])
                for i, clip in enumerate(top_clips)
            ]))

            # ── Step 8: Presign post-cut URL ──────────────────────────────────
            update("Finalising post-cut", 95)
            postcut = render_postcut.remote(job_id, source_key, silence_result)

            # ── Step 9: Persist results ───────────────────────────────────────
            update("Saving results", 98)
            result = {
                "job_id": job_id,
                "transcript": transcript,
                "postcut": postcut,
                "clips": rendered_clips,
            }

            # Final webhook with all results
            if webhook_url:
                try:
                    import json as _json
                    payload = _json.dumps({
                        "status": "completed",
                        "step": "Done",
                        "progress": 100,
                        "transcript": transcript,
                        "postcut": postcut,
                        "clips": rendered_clips,
                    }).encode()
                    req = urllib.request.Request(
                        webhook_url,
                        data=payload,
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    urllib.request.urlopen(req, timeout=30)
                except Exception:
                    pass

            return result

    except Exception as e:
        if webhook_url:
            try:
                import json as _json
                payload = _json.dumps({"status": "failed", "error": str(e)}).encode()
                req = urllib.request.Request(
                    webhook_url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass
        raise


# ── Utility helpers ────────────────────────────────────────────────────────────

def _download_youtube(url: str, output_path: str):
    import subprocess
    subprocess.run(
        ["yt-dlp", "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
         "-o", output_path, url],
        check=True,
    )


def _download_from_wasabi(key: str, output_path: str):
    import os
    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["WASABI_ENDPOINT"],
        aws_access_key_id=os.environ["WASABI_ACCESS_KEY"],
        aws_secret_access_key=os.environ["WASABI_SECRET_KEY"],
    )
    s3.download_file(os.environ["WASABI_BUCKET"], key, output_path)


def _extract_audio(video_path: str, audio_path: str):
    import subprocess
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path,
         "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
         audio_path],
        check=True,
        capture_output=True,
    )


def _upload_to_wasabi(local_path: str, key: str):
    import os
    import boto3
    from botocore.config import Config
    from boto3.s3.transfer import TransferConfig
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["WASABI_ENDPOINT"],
        aws_access_key_id=os.environ["WASABI_ACCESS_KEY"],
        aws_secret_access_key=os.environ["WASABI_SECRET_KEY"],
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )
    transfer_cfg = TransferConfig(max_concurrency=1, multipart_chunksize=16 * 1024 * 1024)
    s3.upload_file(local_path, os.environ["WASABI_BUCKET"], key, Config=transfer_cfg)
