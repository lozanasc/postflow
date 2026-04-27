"""
Semantic highlight extraction using Mistral-7B-Instruct via vLLM.

Chunks the transcript into ~4-minute overlapping windows and dispatches them
to the LLM in parallel. Returns clip candidates with timestamps, virality
scores, and suggested hook text.
"""
import modal
from modal import enter, method
from pipeline.common import app, llm_volume, hf_secret

MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.3"
MODELS_DIR = "/models/llm"
CHUNK_WORDS = 800       # ~4 minutes of speech at average talking pace
CHUNK_OVERLAP = 80      # Overlap between chunks to avoid boundary clipping
CLIPS_PER_CHUNK = 3     # Number of clip candidates to extract per chunk

llm_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "vllm==0.6.6",
        "huggingface_hub",
        "torch==2.5.1",
        "transformers==4.46.3",
    )
)


@app.cls(
    image=llm_image,
    gpu="H100",
    volumes={MODELS_DIR: llm_volume},
    secrets=[hf_secret],
    timeout=3600,
    scaledown_window=300,
)
class HighlightExtractor:
    @enter()
    def load_model(self):
        import os
        from huggingface_hub import snapshot_download
        from vllm import LLM, SamplingParams

        # Download model weights to volume on first run (or if previous download was incomplete)
        import glob
        model_path = f"{MODELS_DIR}/{MODEL_ID.split('/')[-1]}"
        has_weights = bool(
            glob.glob(f"{model_path}/*.safetensors") or glob.glob(f"{model_path}/*.bin")
        )
        if not has_weights:
            snapshot_download(
                repo_id=MODEL_ID,
                local_dir=model_path,
                token=os.environ["HF_TOKEN"],
            )

        self.llm = LLM(
            model=model_path,
            dtype="float16",
            max_model_len=16384,
            gpu_memory_utilization=0.9,
        )
        self.sampling_params = SamplingParams(
            temperature=0.3,
            max_tokens=2048,
        )

    @method()
    def extract(self, word_segments: list[dict]) -> list[dict]:
        """
        Extract viral clip candidates from a word-level transcript.

        Args:
            word_segments: List of {word, start, end, speaker} dicts from WhisperX.

        Returns:
            Sorted list of clip candidates:
            [{start, end, virality_score, hook_text, transcript_excerpt}]
        """
        chunks = _chunk_words(word_segments, CHUNK_WORDS, CHUNK_OVERLAP)
        prompts = [_build_prompt(chunk) for chunk in chunks]

        outputs = self.llm.generate(prompts, self.sampling_params)

        clips: list[dict] = []
        for output, chunk in zip(outputs, chunks):
            raw = output.outputs[0].text.strip()
            parsed = _parse_llm_output(raw, chunk)
            clips.extend(parsed)

        # Deduplicate overlapping clips and sort by virality score
        clips = _deduplicate(clips)
        clips.sort(key=lambda c: c["virality_score"], reverse=True)
        return clips


# ── Helpers ───────────────────────────────────────────────────────────────────

def _chunk_words(
    words: list[dict], size: int, overlap: int
) -> list[list[dict]]:
    """Slice word list into overlapping chunks."""
    chunks = []
    i = 0
    while i < len(words):
        chunk = words[i : i + size]
        chunks.append(chunk)
        i += size - overlap
    return chunks


def _build_prompt(chunk: list[dict]) -> str:
    transcript_text = " ".join(w["word"] for w in chunk)
    start_time = chunk[0].get("start", 0)
    end_time = chunk[-1].get("end", 0)

    return f"""<s>[INST] You are an expert social media content strategist. Analyze podcast transcript chunks and identify the most viral short-form video moments.

Analyze this transcript chunk (from {start_time:.1f}s to {end_time:.1f}s) and identify {CLIPS_PER_CHUNK} distinct moments suitable for short-form video (30-60 seconds each).

Each moment must:
- Be self-contained (understandable without external context)
- Contain a compelling hook in the first 3 seconds
- Have high emotional valence, humor, controversy, or educational value

Transcript:
{transcript_text}

Output a JSON array only. No explanation. Format:
[
  {{
    "start": <float seconds>,
    "end": <float seconds>,
    "virality_score": <int 1-10>,
    "hook_text": "<5 word attention-grabbing text overlay>",
    "reason": "<one sentence why this is viral>"
  }}
] [/INST]"""


def _parse_llm_output(raw: str, chunk: list[dict]) -> list[dict]:
    import json
    import re

    chunk_start = chunk[0].get("start", 0)
    chunk_end = chunk[-1].get("end", 0)

    # Extract JSON array from output
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []

    try:
        items = json.loads(match.group())
    except json.JSONDecodeError:
        return []

    clips = []
    for item in items:
        if not isinstance(item, dict):
            continue
        start = float(item.get("start", chunk_start))
        end = float(item.get("end", chunk_end))
        duration = end - start
        # Filter out clips that are too short or too long
        if duration < 8 or duration > 90:
            continue
        clips.append({
            "start": start,
            "end": end,
            "duration": duration,
            "virality_score": int(item.get("virality_score", 5)),
            "hook_text": str(item.get("hook_text", ""))[:80],
            "reason": str(item.get("reason", ""))[:200],
        })
    return clips


def _deduplicate(clips: list[dict], overlap_threshold: float = 0.5) -> list[dict]:
    """Remove clips that overlap significantly with a higher-scored clip."""
    clips = sorted(clips, key=lambda c: c["virality_score"], reverse=True)
    kept: list[dict] = []
    for clip in clips:
        overlaps = False
        for kept_clip in kept:
            intersection = min(clip["end"], kept_clip["end"]) - max(clip["start"], kept_clip["start"])
            if intersection > 0:
                shorter_duration = min(clip["duration"], kept_clip["duration"])
                if intersection / shorter_duration > overlap_threshold:
                    overlaps = True
                    break
        if not overlaps:
            kept.append(clip)
    return kept
