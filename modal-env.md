# Modal Environment Setup

This document describes every secret and environment variable required to deploy the Postflow Modal pipeline. Never put real credentials in this file — use `.env.local` locally and the Modal dashboard for deployed secrets.

---

## 1. Local Development (`.env.local`)

This file is gitignored. Fill in real values here for local testing.

```
WASABI_ACCESS_KEY=your_access_key
WASABI_SECRET_KEY=your_secret_key
WASABI_BUCKET=postflow-media
WASABI_ENDPOINT=https://s3.ap-southeast-1.wasabisys.com
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
```

---

## 2. HuggingFace Setup

The pipeline uses **pyannote** for speaker diarization (identifying who is speaking). This model is gated and requires a HuggingFace account.

### Step 1 — Create a HuggingFace account
1. Go to **huggingface.co** and sign up for a free account.

### Step 2 — Accept the pyannote model terms
1. Go to **huggingface.co/pyannote/speaker-diarization-3.1**
2. Click **"Agree and access repository"**
3. Also accept terms at **huggingface.co/pyannote/segmentation-3.0** (dependency)

> You must be logged in when you do this. The token won't work if you haven't accepted both.

### Step 3 — Generate an access token
1. Go to **huggingface.co/settings/tokens**
2. Click **"New token"**
3. Name it `postflow`, set role to **Read**
4. Click **Generate** and copy the token (starts with `hf_`)

---

## 3. Modal Secrets

Create these two secrets in the **Modal dashboard → Secrets** before deploying.

### Secret 1: `postflow-wasabi`

| Key | Value |
|---|---|
| `WASABI_ACCESS_KEY` | From Wasabi console → Access Keys |
| `WASABI_SECRET_KEY` | From Wasabi console → Access Keys |
| `WASABI_BUCKET` | `postflow-media` |
| `WASABI_ENDPOINT` | `https://s3.ap-southeast-1.wasabisys.com` |

**How to add:**
1. Go to **modal.com → Secrets → New secret**
2. Name it exactly `postflow-wasabi`
3. Add each key-value pair above
4. Save

### Secret 2: `postflow-hf`

| Key | Value |
|---|---|
| `HF_TOKEN` | Your HuggingFace token from Step 3 above |

**How to add:**
1. Go to **modal.com → Secrets → New secret**
2. Name it exactly `postflow-hf`
3. Add `HF_TOKEN` with your token value
4. Save

---

## 4. Deploying the Pipeline

```bash
# Confirm Modal is authenticated
python -m modal profile list

# Deploy
python -m modal deploy modal/pipeline.py
```

After deploying, Modal will output a URL like:
```
https://lozanascbusiness--postflow-web.modal.run
```

Add this to `.env.local`:
```
MODAL_PIPELINE_URL=https://lozanascbusiness--postflow-web.modal.run
```

---

## 5. Modal Volumes (auto-created)

The pipeline caches model weights in Modal volumes so they aren't re-downloaded on every cold start.

| Volume name | Contents | Size |
|---|---|---|
| `postflow-whisper-models` | WhisperX Large-V3 + alignment weights | ~6 GB |
| `postflow-llm-models` | Llama-3.1-8B-Instruct weights | ~16 GB |

These are created automatically on first deploy. First run will be slow (~10 min for model downloads). All subsequent runs use cached weights.

---

## 6. Checklist Before Deploying

- [ ] Wasabi keys rotated (if previously exposed)
- [ ] HuggingFace account created
- [ ] pyannote model terms accepted (both models)
- [ ] HuggingFace token generated
- [ ] `postflow-wasabi` secret created in Modal dashboard
- [ ] `postflow-hf` secret created in Modal dashboard
- [ ] `.env.local` filled in locally
- [ ] `python -m modal deploy modal/pipeline.py` runs without error
