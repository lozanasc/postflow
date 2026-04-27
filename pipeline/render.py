"""
Video compositing pipeline — Phase 2.

For each LLM-extracted clip candidate:
  1. Slice the clip from the source video at the given timestamps
  2. Reframe to 9:16 vertical (single-speaker center crop, or dual-speaker vstack)
  3. Burn word-level kinetic subtitles from WhisperX timestamps
  4. Upload rendered clip to Wasabi

Speaker layout detection:
  - 1 unique speaker  → center crop
  - 2+ unique speakers → vstack (left quadrant = Speaker A, right = Speaker B)
"""
import modal
from pipeline.common import app, wasabi_secret

TARGET_W = 1080
TARGET_H = 1920

render_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "ffmpeg",
        "imagemagick",
        "fonts-liberation",
        "fonts-noto",
    )
    .pip_install(
        "boto3",
        "moviepy==1.0.3",
        "numpy",
        "pillow",
    )
)


@app.function(
    image=render_image,
    cpu=8,
    memory=16384,
    secrets=[wasabi_secret],
    timeout=3600,
)
def render_clip(
    job_id: str,
    clip_index: int,
    clip: dict,
    source_video_key: str,
    word_segments: list[dict],
) -> dict:
    """
    Render a single vertical clip and upload to Wasabi.

    Args:
        job_id:           Parent job ID.
        clip_index:       Index of this clip in the candidates list.
        clip:             Clip candidate dict {start, end, hook_text, ...}.
        source_video_key: Wasabi key of the original input video.
        word_segments:    Word-level transcript [{word, start, end, speaker}].

    Returns:
        {output_key, duration, hook_text, virality_score, wasabi_url}
    """
    import os
    import tempfile
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["WASABI_ENDPOINT"],
        aws_access_key_id=os.environ["WASABI_ACCESS_KEY"],
        aws_secret_access_key=os.environ["WASABI_SECRET_KEY"],
    )
    bucket = os.environ["WASABI_BUCKET"]

    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = os.path.join(tmpdir, "source.mp4")
        sliced_path = os.path.join(tmpdir, "sliced.mp4")
        framed_path = os.path.join(tmpdir, "framed.mp4")
        subtitled_path = os.path.join(tmpdir, "subtitled.mp4")

        # ── 1. Download source video ──────────────────────────────────────────
        s3.download_file(bucket, source_video_key, source_path)

        # ── 2. Slice clip ─────────────────────────────────────────────────────
        _slice_clip(source_path, sliced_path, clip["start"], clip["end"])

        # ── 3. Detect speaker layout ──────────────────────────────────────────
        clip_words = [
            w for w in word_segments
            if w.get("start", 0) >= clip["start"] and w.get("end", 0) <= clip["end"]
        ]
        speakers = {w.get("speaker") for w in clip_words if w.get("speaker")}
        dual_speaker = len(speakers) >= 2

        # ── 4. Reframe to 9:16 ────────────────────────────────────────────────
        if dual_speaker:
            _reframe_dual(sliced_path, framed_path)
        else:
            _reframe_single(sliced_path, framed_path)

        # ── 5. Generate SRT subtitles ─────────────────────────────────────────
        srt_path = os.path.join(tmpdir, "subs.srt")
        _write_srt(clip_words, srt_path, clip["start"])

        # ── 6. Burn subtitles ─────────────────────────────────────────────────
        _burn_subtitles(framed_path, subtitled_path, srt_path)

        # ── 7. Upload to Wasabi ───────────────────────────────────────────────
        output_key = f"jobs/{job_id}/clips/clip_{clip_index:03d}.mp4"
        s3.upload_file(subtitled_path, bucket, output_key, ExtraArgs={"ContentType": "video/mp4"})

        # Generate presigned URL valid for 7 days
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": output_key},
            ExpiresIn=604800,
        )

    return {
        "output_key": output_key,
        "wasabi_url": url,
        "duration": clip["end"] - clip["start"],
        "hook_text": clip.get("hook_text", ""),
        "virality_score": clip.get("virality_score", 0),
        "start": clip["start"],
        "end": clip["end"],
        "layout": "dual" if dual_speaker else "single",
    }


@app.function(
    image=render_image,
    cpu=4,
    memory=8192,
    secrets=[wasabi_secret],
    timeout=3600,
)
def render_postcut(
    job_id: str,
    source_video_key: str,
    silence_result: dict,
) -> dict:
    """
    Upload the already-rendered post-cut and generate a presigned URL.
    The silence removal step already uploaded the file; this just returns
    a presigned URL for it.
    """
    import os
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["WASABI_ENDPOINT"],
        aws_access_key_id=os.environ["WASABI_ACCESS_KEY"],
        aws_secret_access_key=os.environ["WASABI_SECRET_KEY"],
    )
    bucket = os.environ["WASABI_BUCKET"]
    output_key = silence_result["output_key"]

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": output_key},
        ExpiresIn=604800,
    )

    return {**silence_result, "wasabi_url": url}


# ── FFmpeg helpers ─────────────────────────────────────────────────────────────

def _slice_clip(source: str, output: str, start: float, end: float):
    import subprocess
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-to", str(end),
            "-i", source,
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            output,
        ],
        check=True,
        capture_output=True,
    )


def _get_video_dimensions(path: str) -> tuple[int, int]:
    import json
    import subprocess
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        path,
    ]))
    stream = probe["streams"][0]
    return int(stream["width"]), int(stream["height"])


def _reframe_single(source: str, output: str):
    """Center crop to 9:16 for single-speaker video."""
    import subprocess

    w, h = _get_video_dimensions(source)

    # Calculate the largest 9:16 crop that fits in the frame
    target_ratio = 9 / 16
    if w / h > target_ratio:
        # Wider than 9:16 — crop width
        crop_h = h
        crop_w = int(h * target_ratio)
    else:
        # Taller than 9:16 — crop height
        crop_w = w
        crop_h = int(w / target_ratio)

    x = (w - crop_w) // 2
    y = (h - crop_h) // 2

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-vf", (
                f"crop={crop_w}:{crop_h}:{x}:{y},"
                f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=decrease,"
                f"pad={TARGET_W}:{TARGET_H}:(ow-iw)/2:(oh-ih)/2:black"
            ),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True,
        capture_output=True,
    )


def _reframe_dual(source: str, output: str):
    """
    Dual-speaker vstack layout:
      - Top half:    left quadrant of frame (Speaker A)
      - Bottom half: right quadrant of frame (Speaker B)
    Each half is cropped to a square then scaled to TARGET_W x TARGET_H/2.
    """
    import subprocess

    w, h = _get_video_dimensions(source)
    half_w = w // 2
    half_out_h = TARGET_H // 2

    # Square crop from each side, then scale to target width
    crop_size = min(half_w, h)
    left_x = (half_w - crop_size) // 2
    right_x = half_w + (half_w - crop_size) // 2
    crop_y = (h - crop_size) // 2

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-filter_complex", (
                f"[0:v]crop={crop_size}:{crop_size}:{left_x}:{crop_y},"
                f"scale={TARGET_W}:{half_out_h}[top];"
                f"[0:v]crop={crop_size}:{crop_size}:{right_x}:{crop_y},"
                f"scale={TARGET_W}:{half_out_h}[bottom];"
                "[top][bottom]vstack=inputs=2[v]"
            ),
            "-map", "[v]", "-map", "0:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True,
        capture_output=True,
    )


def _write_srt(
    words: list[dict],
    srt_path: str,
    clip_start: float,
    words_per_group: int = 3,
):
    """
    Write an SRT file from word-level timestamps.
    Groups words into short caption blocks for kinetic readability.
    Timestamps are adjusted relative to clip_start.
    """
    def fmt_time(seconds: float) -> str:
        seconds = max(0.0, seconds)
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    # Filter words that have valid timestamps
    valid = [w for w in words if "start" in w and "end" in w and w.get("word", "").strip()]

    groups = [valid[i:i + words_per_group] for i in range(0, len(valid), words_per_group)]

    with open(srt_path, "w", encoding="utf-8") as f:
        for i, group in enumerate(groups, 1):
            start = group[0]["start"] - clip_start
            end = group[-1]["end"] - clip_start
            text = " ".join(w["word"].strip() for w in group).upper()
            f.write(f"{i}\n{fmt_time(start)} --> {fmt_time(end)}\n{text}\n\n")


def _burn_subtitles(source: str, output: str, srt_path: str):
    """
    Burn SRT subtitles into the video using FFmpeg's subtitles filter.
    Styled for short-form social: large bold white text, black stroke, centered bottom third.
    """
    import subprocess

    # Escape the SRT path for the subtitles filter (Windows backslashes need escaping)
    escaped_srt = srt_path.replace("\\", "/").replace(":", "\\:")

    subtitle_style = (
        "FontName=Liberation Sans,"
        "FontSize=22,"
        "Bold=1,"
        "PrimaryColour=&H00FFFFFF,"   # White text
        "OutlineColour=&H00000000,"   # Black outline
        "BackColour=&H80000000,"      # Semi-transparent background
        "Outline=3,"
        "Shadow=1,"
        "Alignment=2,"                # Bottom center
        "MarginV=120"                 # Push up from bottom edge
    )

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-vf", f"subtitles='{escaped_srt}':force_style='{subtitle_style}'",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True,
        capture_output=True,
    )
