"""
Semantic highlight extraction using Llama-3.1-8B-Instruct via vLLM.

Key design: the LLM never outputs timestamps — it outputs sentence indices.
Words are first grouped into timestamped sentences, the LLM picks which
sentence range forms each clip, then Python resolves those back to exact
word-level timestamps. This eliminates hallucinated timestamps entirely.
"""
import modal
from modal import enter, method
from pipeline.common import app, llm_volume, hf_secret

MODEL_ID = "meta-llama/Meta-Llama-3.1-8B-Instruct"
MODELS_DIR = "/models/llm"

# Sentence grouping
MAX_WORDS_PER_SENTENCE = 20       # Hard cap; pauses split earlier
PAUSE_THRESHOLD = 0.7             # Seconds of silence → new sentence

# Chunking (in sentences, not words)
SENTENCES_PER_CHUNK = 80          # ~6-8 minutes of speech per chunk
CHUNK_OVERLAP_SENTENCES = 12      # Overlap to avoid missing clips at boundaries
CLIPS_PER_CHUNK = 3               # Max candidates extracted per chunk

# Clip length filters
MIN_CLIP_DURATION = 20            # seconds
MAX_CLIP_DURATION = 120           # seconds

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
        import glob, os
        from huggingface_hub import snapshot_download
        from vllm import LLM, SamplingParams

        model_path = f"{MODELS_DIR}/{MODEL_ID.split('/')[-1]}"
        has_weights = bool(
            glob.glob(f"{model_path}/*.safetensors")
            or glob.glob(f"{model_path}/*.bin")
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
            temperature=0.1,
            max_tokens=1024,
            stop=["<|eot_id|>"],
        )

    @method()
    def summarize(self, word_segments: list[dict]) -> str:
        """
        Summarize the full video transcript.
        Used as context for highlight extraction so clips stay on-topic.
        """
        full_text = " ".join(w["word"].strip() for w in word_segments)
        # Truncate to ~6000 words (~40 min of speech) to fit context
        words = full_text.split()
        if len(words) > 6000:
            full_text = " ".join(words[:6000]) + "..."

        prompt = _build_summary_prompt(full_text)
        output = self.llm.generate([prompt], self.sampling_params)
        return output[0].outputs[0].text.strip()

    @method()
    def extract(self, word_segments: list[dict], summary: str = "") -> list[dict]:
        """
        Extract viral clip candidates from a word-level transcript.

        Args:
            word_segments: [{word, start, end, speaker}] from WhisperX.
            summary:       Full-video summary — keeps clips on-topic.

        Returns:
            Sorted list of clip candidates:
            [{start, end, duration, virality_score, hook_text, reason}]
        """
        # Group words into sentences so the LLM works with text units,
        # not raw floats. Each sentence carries its real timestamps.
        sentences = _to_sentences(word_segments)

        chunks = _chunk_sentences(sentences, SENTENCES_PER_CHUNK, CHUNK_OVERLAP_SENTENCES)
        prompts = [_build_prompt(chunk, summary) for chunk in chunks]

        outputs = self.llm.generate(prompts, self.sampling_params)

        clips: list[dict] = []
        for output, chunk in zip(outputs, chunks):
            raw = output.outputs[0].text.strip()
            parsed = _parse_llm_output(raw, chunk)
            clips.extend(parsed)

        clips = _deduplicate(clips)
        clips.sort(key=lambda c: c["virality_score"], reverse=True)
        return clips


# ── Sentence grouping ──────────────────────────────────────────────────────────

def _to_sentences(words: list[dict]) -> list[dict]:
    """
    Group words into sentences by splitting on pauses or word-count cap.
    Each sentence retains its start/end timestamps from the word segments.
    """
    sentences: list[dict] = []
    current: list[dict] = []

    for i, word in enumerate(words):
        current.append(word)

        at_cap = len(current) >= MAX_WORDS_PER_SENTENCE
        long_pause = (
            i + 1 < len(words)
            and (words[i + 1].get("start", 0) - word.get("end", 0)) > PAUSE_THRESHOLD
        )
        last_word = (i == len(words) - 1)

        if (at_cap or long_pause or last_word) and current:
            sentences.append({
                "start": current[0].get("start", 0),
                "end":   current[-1].get("end", 0),
                "text":  " ".join(w["word"].strip() for w in current),
            })
            current = []

    return sentences


def _chunk_sentences(
    sentences: list[dict], size: int, overlap: int
) -> list[list[dict]]:
    chunks: list[list[dict]] = []
    i = 0
    while i < len(sentences):
        chunks.append(sentences[i : i + size])
        i += size - overlap
    return chunks


# ── Prompt ─────────────────────────────────────────────────────────────────────

def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02d}"


def _build_summary_prompt(full_text: str) -> str:
    system = (
        "You are an expert content analyst. "
        "You summarize video and podcast transcripts accurately and concisely."
    )
    user = f"""Summarize this transcript in 3–5 sentences. Be specific about:
1. What kind of content this is (interview, tutorial, story, debate, etc.)
2. The main topic and who is speaking / what they're discussing
3. The key arguments, insights, or information presented
4. Any important context a video editor needs to make clips that represent the video honestly

Transcript:
{full_text}

Write only the summary. No preamble, no labels."""

    return _llama_prompt(system, user)


def _build_prompt(sentences: list[dict], summary: str = "") -> str:
    seg_start = sentences[0]["start"]
    seg_end   = sentences[-1]["end"]

    lines = "\n".join(
        f"[{i + 1}] ({_fmt_time(s['start'])}) {s['text']}"
        for i, s in enumerate(sentences)
    )

    system = (
        "You are an expert short-form video editor. "
        "Your job is to find the best moments in podcast/talk transcripts "
        "that will perform well as TikTok, Instagram Reels, or YouTube Shorts clips."
    )

    context_block = ""
    if summary:
        context_block = f"""VIDEO CONTEXT (use this to judge clip relevance and accuracy):
{summary}

Only extract clips that are meaningfully connected to the above context.
Do not extract moments that misrepresent the video's main point or take statements out of context.

"""

    user = f"""{context_block}Transcript segment ({_fmt_time(seg_start)} – {_fmt_time(seg_end)}):

{lines}

Find up to {CLIPS_PER_CHUNK} clip moments that would work as standalone short-form videos.

A great clip:
- Opens with a strong hook (surprising fact, bold claim, emotional moment, punchline)
- Is self-contained — a viewer with no context understands and is entertained
- Has a clear arc: setup → payoff, or question → answer, or claim → evidence
- Accurately represents the video's overall message — no out-of-context clips
- Runs 30–90 seconds

Use sentence numbers [1]–[{len(sentences)}] to define boundaries.

Respond with a JSON array only — no explanation, no markdown fences.
[
  {{
    "from_sentence": <int>,
    "to_sentence": <int>,
    "virality_score": <int 1-10>,
    "hook_text": "<3-6 word punchy overlay text>",
    "reason": "<one sentence: why this moment is viral>"
  }}
]"""

    return _llama_prompt(system, user)


def _llama_prompt(system: str, user: str) -> str:
    """Format a prompt in Llama 3.1 chat template format."""
    return (
        "<|begin_of_text|>"
        "<|start_header_id|>system<|end_header_id|>\n\n"
        f"{system}<|eot_id|>"
        "<|start_header_id|>user<|end_header_id|>\n\n"
        f"{user}<|eot_id|>"
        "<|start_header_id|>assistant<|end_header_id|>\n\n"
    )


# ── Output parsing ─────────────────────────────────────────────────────────────

def _parse_llm_output(raw: str, sentences: list[dict]) -> list[dict]:
    import json, re

    # Extract first JSON array from the output
    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if not match:
        return []

    try:
        items = json.loads(match.group())
    except json.JSONDecodeError:
        return []

    clips: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue

        # Convert 1-indexed sentence numbers → 0-indexed, clamped to valid range
        from_idx = max(0, int(item.get("from_sentence", 1)) - 1)
        to_idx   = min(len(sentences) - 1, int(item.get("to_sentence", len(sentences))) - 1)
        if from_idx > to_idx:
            continue

        start    = sentences[from_idx]["start"]
        end      = sentences[to_idx]["end"]
        duration = end - start

        if duration < MIN_CLIP_DURATION or duration > MAX_CLIP_DURATION:
            continue

        clips.append({
            "start":         start,
            "end":           end,
            "duration":      duration,
            "virality_score": max(1, min(10, int(item.get("virality_score", 5)))),
            "hook_text":     str(item.get("hook_text", ""))[:80],
            "reason":        str(item.get("reason", ""))[:200],
        })

    return clips


# ── Deduplication ──────────────────────────────────────────────────────────────

def _deduplicate(clips: list[dict], overlap_threshold: float = 0.5) -> list[dict]:
    """Drop clips that overlap significantly with a higher-scored one."""
    clips = sorted(clips, key=lambda c: c["virality_score"], reverse=True)
    kept: list[dict] = []
    for clip in clips:
        overlapping = False
        for k in kept:
            intersection = min(clip["end"], k["end"]) - max(clip["start"], k["start"])
            if intersection > 0:
                shorter = min(clip["duration"], k["duration"])
                if intersection / shorter > overlap_threshold:
                    overlapping = True
                    break
        if not overlapping:
            kept.append(clip)
    return kept
