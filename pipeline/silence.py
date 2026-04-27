"""
Silence removal pipeline using FFmpeg.

CPU-bound. Detects and removes dead air, then re-encodes a clean "post-cut" video.
Applies a pacing margin so cuts don't feel jarring.
"""
import modal
from pipeline.common import app, wasabi_secret

SILENCE_DB = -35        # dB threshold below which audio counts as silence
SILENCE_DURATION = 0.5  # Minimum seconds of silence to trigger a cut
PACING_MARGIN = 0.2     # Seconds of silence to keep before/after each speech block

silence_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("boto3")
)


@app.function(
    image=silence_image,
    cpu=4,
    memory=8192,
    secrets=[wasabi_secret],
    timeout=7200,
)
def remove_silence(
    input_wasabi_key: str,
    output_key: str,
    silence_db: float = SILENCE_DB,
    silence_duration: float = SILENCE_DURATION,
    pacing_margin: float = PACING_MARGIN,
) -> dict:
    """
    Download video from Wasabi, remove silence, upload post-cut back to Wasabi.

    Args:
        input_wasabi_key: Wasabi object key of the source video.
        output_key:       Wasabi object key for the rendered post-cut.
        silence_db:       dB threshold for silence detection.
        silence_duration: Minimum silence duration in seconds to cut.
        pacing_margin:    Seconds of buffer to retain around speech blocks.

    Returns:
        {"output_key": str, "duration_original": float, "duration_cut": float, "time_saved": float}
    """
    import json
    import os
    import re
    import subprocess
    import tempfile

    import boto3

    from botocore.config import Config
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["WASABI_ENDPOINT"],
        aws_access_key_id=os.environ["WASABI_ACCESS_KEY"],
        aws_secret_access_key=os.environ["WASABI_SECRET_KEY"],
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )
    bucket = os.environ["WASABI_BUCKET"]

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.mp4")

        # ── 0. Download source video ──────────────────────────────────────────
        s3.download_file(bucket, input_wasabi_key, input_path)

        # ── 1. Detect silence intervals ───────────────────────────────────────
        probe = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            input_path,
        ]))
        original_duration = float(probe["format"]["duration"])

        result = subprocess.run(
            ["ffmpeg", "-i", input_path,
             "-af", f"silencedetect=noise={silence_db}dB:d={silence_duration}",
             "-f", "null", "-"],
            capture_output=True, text=True,
        )
        starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", result.stderr)]
        ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", result.stderr)]

        # ── 2. Build speech intervals (inverted silence) ──────────────────────
        speech_intervals: list[tuple[float, float]] = []
        cursor = 0.0
        for s_start, s_end in zip(starts, ends):
            speech_start = max(0.0, cursor - pacing_margin)
            speech_end = s_start + pacing_margin
            if speech_end > speech_start:
                speech_intervals.append((speech_start, speech_end))
            cursor = s_end
        if cursor < original_duration:
            speech_intervals.append((max(0.0, cursor - pacing_margin), original_duration))
        if not speech_intervals:
            raise ValueError("No speech detected in video.")

        # ── 3. Merge overlapping intervals ────────────────────────────────────
        merged: list[tuple[float, float]] = [speech_intervals[0]]
        for start, end in speech_intervals[1:]:
            if start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))

        # ── 4. Slice segments and concat ─────────────────────────────────────
        seg_dir = os.path.join(tmpdir, "segs")
        os.makedirs(seg_dir)
        segment_list = []
        for i, (start, end) in enumerate(merged):
            seg_path = os.path.join(seg_dir, f"seg_{i:04d}.mp4")
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(start), "-to", str(end),
                 "-i", input_path, "-c", "copy", seg_path],
                check=True, capture_output=True,
            )
            segment_list.append(seg_path)

        manifest_path = os.path.join(tmpdir, "manifest.txt")
        with open(manifest_path, "w") as f:
            for seg in segment_list:
                f.write(f"file '{seg}'\n")

        output_path = os.path.join(tmpdir, "postcut.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
             "-i", manifest_path, "-c", "copy", output_path],
            check=True, capture_output=True,
        )

        # ── 5. Get output duration ────────────────────────────────────────────
        probe2 = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json", output_path,
        ]))
        cut_duration = float(probe2["format"]["duration"])

        # ── 6. Upload to Wasabi ───────────────────────────────────────────────
        from boto3.s3.transfer import TransferConfig
        transfer_cfg = TransferConfig(max_concurrency=1, multipart_chunksize=16 * 1024 * 1024)
        s3.upload_file(output_path, bucket, output_key, Config=transfer_cfg)

    return {
        "output_key": output_key,
        "duration_original": original_duration,
        "duration_cut": cut_duration,
        "time_saved": original_duration - cut_duration,
    }
