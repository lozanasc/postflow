"""
WhisperX transcription pipeline.

Runs on L40S GPU. Outputs word-level timestamps with speaker diarization.
Model weights cached in Modal volume to avoid re-downloading on cold starts.
"""
import modal
from modal import enter, method
from pipeline.common import app, whisper_volume

WHISPER_MODEL = "large-v3"
MODELS_DIR = "/models"

transcription_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "git", "curl")
    .pip_install(
        "torch==2.3.1",
        "torchaudio==2.3.1",
        index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "whisperx @ git+https://github.com/m-bain/whisperX.git",
    )
)


@app.cls(
    image=transcription_image,
    gpu="L40S",
    volumes={MODELS_DIR: whisper_volume},
    timeout=3600,
    scaledown_window=300,  # Keep warm for 5 min between requests
)
class Transcriber:
    @enter()
    def load_model(self):
        import whisperx

        self.model = whisperx.load_model(
            WHISPER_MODEL,
            device="cuda",
            compute_type="float16",
            download_root=f"{MODELS_DIR}/whisper",
        )

    @method()
    def run(self, audio_bytes: bytes, language: str | None = None) -> dict:
        """
        Transcribe audio with word-level timestamps and speaker diarization.

        Args:
            audio_bytes: Raw audio file bytes (WAV 16kHz mono) to transcribe.
            language:    ISO 639-1 language code, e.g. "en". Auto-detected if None.

        Returns:
            {
              "segments": [...],   # WhisperX segment dicts
              "word_segments": [...],  # word-level [{word, start, end, speaker}]
              "language": "en",
            }
        """
        import tempfile
        import whisperx

        # Write bytes to a temp file so whisperx can load it
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            audio_path = tmp.name

        # 1. Load audio
        audio = whisperx.load_audio(audio_path)

        # 2. Transcribe
        result = self.model.transcribe(audio, batch_size=16, language=language)
        detected_lang = result["language"]

        # 3. Word-level alignment
        align_model, metadata = whisperx.load_align_model(
            language_code=detected_lang,
            device="cuda",
            model_dir=f"{MODELS_DIR}/align",
        )
        result = whisperx.align(
            result["segments"],
            align_model,
            metadata,
            audio,
            device="cuda",
            return_char_alignments=False,
        )

        return {
            "segments": result["segments"],
            "word_segments": result.get("word_segments", []),
            "language": detected_lang,
        }
