"""
Shared Modal app instance, volumes, and secrets for the Postflow pipeline.
"""
import modal

app = modal.App("postflow")

# Persistent volumes for model caching (avoids re-downloading on cold starts)
whisper_volume = modal.Volume.from_name("postflow-whisper-models", create_if_missing=True)
llm_volume = modal.Volume.from_name("postflow-llm-models", create_if_missing=True)

# Secrets — create these in the Modal dashboard before deploying:
#   postflow-wasabi: WASABI_ACCESS_KEY, WASABI_SECRET_KEY, WASABI_BUCKET, WASABI_ENDPOINT
#   postflow-hf:     HF_TOKEN (HuggingFace token for pyannote diarization model)
wasabi_secret = modal.Secret.from_name("postflow-wasabi")
hf_secret = modal.Secret.from_name("postflow-hf")
