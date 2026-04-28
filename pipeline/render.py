"""
Video compositing pipeline — template-driven rendering.

Template config controls:
  aspectRatio   9:16 | 1:1 | 16:9
  layout        single | dual | pip (pip falls back to single)
  background    blur | color | none
  subtitles     enabled, style (default|bold|karaoke|outline), position, fontSize, color
  watermark     enabled, text, position
"""
import modal
from pipeline.common import app, wasabi_secret

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
    template_config: dict | None = None,
) -> dict:
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

    # ── Parse template config ─────────────────────────────────────────────────
    cfg = template_config or {}
    aspect_ratio  = cfg.get("aspectRatio", "9:16")
    layout_mode   = cfg.get("layout", "auto")   # single | dual | pip | auto

    bg            = cfg.get("background", {})
    bg_type       = bg.get("type", "blur")       # blur | color | none
    bg_color      = bg.get("color", "#000000")

    subs_cfg      = cfg.get("subtitles", {})
    subs_enabled  = subs_cfg.get("enabled", True)
    subs_style    = subs_cfg.get("style", "default")  # default | bold | karaoke | outline
    subs_position = subs_cfg.get("position", "bottom")
    subs_font_size = int(subs_cfg.get("fontSize", 32))
    subs_color    = subs_cfg.get("color", "#ffffff")

    wm_cfg        = cfg.get("watermark", {})
    wm_enabled    = wm_cfg.get("enabled", False)
    wm_text       = wm_cfg.get("text", "")
    wm_position   = wm_cfg.get("position", "bottom-right")

    target_w, target_h = _get_target_dims(aspect_ratio)

    with tempfile.TemporaryDirectory() as tmpdir:
        source_path   = os.path.join(tmpdir, "source.mp4")
        sliced_path   = os.path.join(tmpdir, "sliced.mp4")
        framed_path   = os.path.join(tmpdir, "framed.mp4")

        # ── 1. Download + slice ───────────────────────────────────────────────
        s3.download_file(bucket, source_video_key, source_path)
        _slice_clip(source_path, sliced_path, clip["start"], clip["end"])

        # ── 2. Detect speaker layout ──────────────────────────────────────────
        clip_words = [
            w for w in word_segments
            if w.get("start", 0) >= clip["start"] and w.get("end", 0) <= clip["end"]
        ]
        speakers = {w.get("speaker") for w in clip_words if w.get("speaker")}
        dual_speaker = len(speakers) >= 2

        if layout_mode == "single":
            use_dual = False
        elif layout_mode == "dual":
            use_dual = True
        else:  # "auto" or "pip" (pip treated as single until face detection is added)
            use_dual = dual_speaker

        # ── 3. Reframe ────────────────────────────────────────────────────────
        if use_dual:
            _reframe_dual(sliced_path, framed_path, target_w, target_h)
        else:
            _reframe_single(sliced_path, framed_path, target_w, target_h, bg_type, bg_color)

        current_path = framed_path

        # ── 4. Subtitles ──────────────────────────────────────────────────────
        if subs_enabled and clip_words:
            srt_path  = os.path.join(tmpdir, "subs.srt")
            sub_path  = os.path.join(tmpdir, "subtitled.mp4")
            _write_srt(clip_words, srt_path, clip["start"], style=subs_style)
            _burn_subtitles(
                current_path, sub_path, srt_path,
                style=subs_style,
                position=subs_position,
                font_size=subs_font_size,
                color=subs_color,
                target_h=target_h,
            )
            current_path = sub_path

        # ── 5. Watermark ──────────────────────────────────────────────────────
        if wm_enabled and wm_text:
            wm_path = os.path.join(tmpdir, "watermarked.mp4")
            _burn_watermark(current_path, wm_path, wm_text, wm_position)
            current_path = wm_path

        # ── 6. Upload ─────────────────────────────────────────────────────────
        output_key = f"jobs/{job_id}/clips/clip_{clip_index:03d}.mp4"
        s3.upload_file(current_path, bucket, output_key, ExtraArgs={"ContentType": "video/mp4"})
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
        "layout": "dual" if use_dual else "single",
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
    """Generate a presigned URL for the already-uploaded post-cut video."""
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


# ── Dimension helpers ──────────────────────────────────────────────────────────

def _get_target_dims(aspect_ratio: str) -> tuple[int, int]:
    if aspect_ratio == "1:1":
        return 1080, 1080
    elif aspect_ratio == "16:9":
        return 1920, 1080
    else:  # "9:16" default
        return 1080, 1920


def _hex_to_ass(hex_color: str) -> str:
    """Convert #RRGGBB to ASS &H00BBGGRR format."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


# ── FFmpeg reframe helpers ─────────────────────────────────────────────────────

def _slice_clip(source: str, output: str, start: float, end: float):
    import subprocess
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", str(start), "-to", str(end),
            "-i", source,
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            output,
        ],
        check=True, capture_output=True,
    )


def _get_video_dimensions(path: str) -> tuple[int, int]:
    import json, subprocess
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json", path,
    ]))
    s = probe["streams"][0]
    return int(s["width"]), int(s["height"])


def _reframe_single(
    source: str,
    output: str,
    target_w: int,
    target_h: int,
    bg_type: str = "blur",
    bg_color: str = "#000000",
):
    import subprocess

    w, h = _get_video_dimensions(source)

    # Largest crop that matches target aspect ratio
    target_ratio = target_w / target_h
    if w / h > target_ratio:
        crop_h = h
        crop_w = int(h * target_ratio)
    else:
        crop_w = w
        crop_h = int(w / target_ratio)

    x = (w - crop_w) // 2
    y = (h - crop_h) // 2

    if bg_type == "blur":
        # Background: full frame scaled + blurred; foreground: cropped + scaled
        filter_complex = (
            f"[0:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},"
            f"boxblur=20:5[bg];"
            f"[0:v]crop={crop_w}:{crop_h}:{x}:{y},"
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[v]"
        )
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source,
                "-filter_complex", filter_complex,
                "-map", "[v]", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k",
                output,
            ],
            check=True, capture_output=True,
        )
    else:
        # Solid color background (or none → black)
        pad_color = "0x" + bg_color.lstrip("#") if bg_type == "color" else "0x000000"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source,
                "-vf", (
                    f"crop={crop_w}:{crop_h}:{x}:{y},"
                    f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
                    f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:color={pad_color}"
                ),
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k",
                output,
            ],
            check=True, capture_output=True,
        )


def _reframe_dual(source: str, output: str, target_w: int, target_h: int):
    """Dual-speaker vstack: left half → top, right half → bottom."""
    import subprocess

    w, h = _get_video_dimensions(source)
    half_w = w // 2
    half_out_h = target_h // 2

    crop_size = min(half_w, h)
    left_x  = (half_w - crop_size) // 2
    right_x = half_w + (half_w - crop_size) // 2
    crop_y  = (h - crop_size) // 2

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-filter_complex", (
                f"[0:v]crop={crop_size}:{crop_size}:{left_x}:{crop_y},"
                f"scale={target_w}:{half_out_h}[top];"
                f"[0:v]crop={crop_size}:{crop_size}:{right_x}:{crop_y},"
                f"scale={target_w}:{half_out_h}[bottom];"
                "[top][bottom]vstack=inputs=2[v]"
            ),
            "-map", "[v]", "-map", "0:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True, capture_output=True,
    )


# ── Subtitle helpers ───────────────────────────────────────────────────────────

def _write_srt(
    words: list[dict],
    srt_path: str,
    clip_start: float,
    style: str = "default",
    words_per_group: int = 3,
):
    def fmt(seconds: float) -> str:
        seconds = max(0.0, seconds)
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    valid = [w for w in words if "start" in w and "end" in w and w.get("word", "").strip()]

    # Karaoke: one word per entry; others: group N words
    if style == "karaoke":
        groups = [[w] for w in valid]
    else:
        groups = [valid[i:i + words_per_group] for i in range(0, len(valid), words_per_group)]

    with open(srt_path, "w", encoding="utf-8") as f:
        for i, group in enumerate(groups, 1):
            start = group[0]["start"] - clip_start
            end   = group[-1]["end"]  - clip_start
            text  = " ".join(w["word"].strip() for w in group).upper()
            f.write(f"{i}\n{fmt(start)} --> {fmt(end)}\n{text}\n\n")


def _burn_subtitles(
    source: str,
    output: str,
    srt_path: str,
    style: str = "default",
    position: str = "bottom",
    font_size: int = 32,
    color: str = "#ffffff",
    target_h: int = 1920,
):
    import subprocess

    # ASS alignment: 2=bottom-center, 5=middle-center, 8=top-center
    alignment_map = {"bottom": 2, "center": 5, "top": 8}
    margin_map = {
        "bottom": int(target_h * 0.06),
        "center": 0,
        "top":    int(target_h * 0.04),
    }
    alignment = alignment_map.get(position, 2)
    margin_v  = margin_map.get(position, int(target_h * 0.06))
    ass_color = _hex_to_ass(color)

    base_style = (
        f"FontName=Liberation Sans,"
        f"FontSize={font_size},"
        f"PrimaryColour={ass_color},"
        f"Alignment={alignment},"
        f"MarginV={margin_v},"
        f"Bold=1,"
        f"OutlineColour=&H00000000"
    )

    style_extras = {
        "default":  ",Outline=3,Shadow=1,BackColour=&H80000000",
        "bold":     ",Outline=3,Shadow=0,BackColour=&H00000000",
        "karaoke":  ",Outline=2,Shadow=1,BackColour=&H00000000",
        "outline":  ",Outline=5,Shadow=0,BackColour=&H00000000",
    }
    subtitle_style = base_style + style_extras.get(style, style_extras["default"])

    escaped_srt = srt_path.replace("\\", "/").replace(":", "\\:")

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-vf", f"subtitles='{escaped_srt}':force_style='{subtitle_style}'",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True, capture_output=True,
    )


# ── Watermark helper ───────────────────────────────────────────────────────────

def _burn_watermark(source: str, output: str, text: str, position: str):
    import subprocess

    margin = 40
    pos_map = {
        "top-left":     (str(margin), str(margin)),
        "top-right":    (f"w-text_w-{margin}", str(margin)),
        "bottom-left":  (str(margin), f"h-text_h-{margin}"),
        "bottom-right": (f"w-text_w-{margin}", f"h-text_h-{margin}"),
    }
    x, y = pos_map.get(position, pos_map["bottom-right"])

    # Escape text for ffmpeg drawtext
    safe_text = text.replace("'", "\\'").replace(":", "\\:")

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", source,
            "-vf", (
                f"drawtext=text='{safe_text}':"
                f"fontsize=36:fontcolor=white:"
                f"x={x}:y={y}:"
                f"shadowx=2:shadowy=2:shadowcolor=black"
            ),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy",
            output,
        ],
        check=True, capture_output=True,
    )
