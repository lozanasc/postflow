"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { UploadIcon, LinkIcon, FileVideoIcon, CheckIcon, SlidersHorizontalIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"
import { SYSTEM_TEMPLATES, type ClipTemplate } from "@/lib/template-types"

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024 // 10 GB

function isValidYouTubeUrl(url: string): boolean {
  if (!url.trim()) return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("youtube-nocookie.com")
    )
  } catch {
    return false
  }
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null
    }
    return u.searchParams.get("v")
  } catch {
    return null
  }
}

export function UploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<"idle" | "uploading" | "queuing" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Processing options
  const [maxClips, setMaxClips] = useState(5)
  const [selectedTemplateId, setSelectedTemplateId] = useState("system-default")
  const [userTemplates, setUserTemplates] = useState<ClipTemplate[]>([])

  const allTemplates = [...SYSTEM_TEMPLATES, ...userTemplates]

  const youtubeValid = isValidYouTubeUrl(youtubeUrl)
  const youtubeId = youtubeValid ? getYouTubeVideoId(youtubeUrl) : null

  // Native HTML5 drag & drop handlers (no extra deps)
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoading) setIsDragging(true)
  }
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoading) setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (isLoading) return

    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return

    if (!dropped.type.startsWith("video/")) {
      const msg = "Please drop a video file (MP4, MOV, etc.)"
      setError(msg)
      toast.error(msg)
      return
    }
    if (dropped.size > MAX_FILE_SIZE) {
      const msg = "File exceeds 10 GB limit"
      setError(msg)
      toast.error(msg)
      return
    }
    setFile(dropped)
    setError(null)
    toast.success("File ready for upload")
  }

  function openFilePicker() {
    if (!isLoading) fileInputRef.current?.click()
  }

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.user) setUserTemplates(data.user.map((t: ClipTemplate) => ({ ...t, isSystem: false }))) })
      .catch(() => {})
  }, [])

  function buildIngestBody(extra: Record<string, unknown>) {
    return JSON.stringify({
      ...extra,
      maxClips,
      templateId: selectedTemplateId,
    })
  }

  async function handleFileUpload() {
    if (!file) return
    setError(null)
    setStatus("uploading")
    setUploadProgress(0)

    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!presignRes.ok) throw new Error("Failed to get upload URL")
      const { url, key } = await presignRes.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error("Upload failed"))
        xhr.open("PUT", url)
        xhr.setRequestHeader("Content-Type", file.type)
        xhr.send(file)
      })

      setStatus("queuing")
      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildIngestBody({ wasabiKey: key }),
      })
      if (!ingestRes.ok) throw new Error("Failed to start processing")
      const { jobId } = await ingestRes.json()

      setStatus("done")
      toast.success("Processing started")
      router.push(`/dashboard/jobs/${jobId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setStatus("error")
      toast.error(msg)
    }
  }

  async function handleYouTubeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!youtubeUrl.trim()) return
    if (!youtubeValid) {
      const msg = "Please enter a valid YouTube URL"
      setError(msg)
      toast.error(msg)
      return
    }
    setError(null)
    setStatus("queuing")

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildIngestBody({ youtubeUrl }),
      })
      if (!res.ok) throw new Error("Failed to start processing")
      const { jobId } = await res.json()
      setStatus("done")
      toast.success("Processing started")
      router.push(`/dashboard/jobs/${jobId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setStatus("error")
      toast.error(msg)
    }
  }

  const isLoading = status === "uploading" || status === "queuing"

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <Tabs defaultValue="youtube" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-fit">
          <TabsTrigger value="youtube">
            <LinkIcon className="mr-2 h-4 w-4" />
            YouTube URL
          </TabsTrigger>
          <TabsTrigger value="file">
            <UploadIcon className="mr-2 h-4 w-4" />
            Upload File
          </TabsTrigger>
        </TabsList>

        {/* YouTube tab */}
        <TabsContent value="youtube">
          <Card>
            <CardHeader>
              <CardTitle>Paste a YouTube link</CardTitle>
              <CardDescription>
                We&apos;ll download and process the video automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleYouTubeSubmit} className="flex flex-col gap-4">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isLoading}
                  aria-invalid={youtubeUrl.trim().length > 0 && !youtubeValid}
                />
                {/* Simple visual preview area with URL validation */}
                {youtubeUrl.trim() && (
                  <div
                    className={`rounded-lg border p-3 text-sm transition-colors ${
                      youtubeValid
                        ? "border-primary/40 bg-primary/5"
                        : "border-destructive/40 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded bg-black/80 text-[10px] font-medium tracking-[1px] text-white/90">
                        <PlayIcon className="mr-0.5 h-3 w-3" /> YT
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {youtubeValid ? "YouTube video detected" : "Invalid YouTube URL"}
                        </div>
                        {youtubeId && (
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                            ID: {youtubeId}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {youtubeValid
                            ? "Preview ready — video will be fetched on submit."
                            : "Enter a full youtube.com or youtu.be link."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={isLoading || !youtubeValid}>
                  {status === "queuing" ? "Starting..." : "Process Video"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File upload tab */}
        <TabsContent value="file">
          <Card>
            <CardHeader>
              <CardTitle>Upload a video file</CardTitle>
              <CardDescription>
                Supports MP4, MOV, MKV, AVI up to 10 GB.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > MAX_FILE_SIZE) {
                    const msg = "File exceeds 10 GB limit"
                    setError(msg)
                    toast.error(msg)
                    return
                  }
                  setFile(f)
                  setError(null)
                  toast.success("File ready for upload")
                }}
              />
              {/* Native drag & drop dropzone — highlights on dragover */}
              <div
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFilePicker() } }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-muted-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01] text-foreground"
                    : "border-border hover:border-primary hover:text-foreground"
                } ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                aria-label="Click or drag and drop a video file"
              >
                <FileVideoIcon className="h-10 w-10" />
                {file ? (
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                ) : (
                  <span className="text-sm text-center">
                    {isDragging ? "Drop video file here" : "Click to choose a file or drag and drop"}
                  </span>
                )}
                {file && (
                  <Badge variant="secondary">
                    {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </Badge>
                )}
              </div>

              {status === "uploading" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Uploading to storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Errors shown via sonner toast + inline for context */}
              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button onClick={handleFileUpload} disabled={!file || isLoading}>
                {status === "uploading" ? "Uploading..." : status === "queuing" ? "Starting..." : "Process Video"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Processing options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontalIcon className="h-4 w-4" />
            Processing Options
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Max clips */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Max clips to extract</label>
              <span className="text-sm font-semibold tabular-nums">{maxClips}</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={maxClips}
              onChange={(e) => setMaxClips(Number(e.target.value))}
              disabled={isLoading}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          <Separator />

          {/* Template picker — with CSS mini aspect ratio visual indicators */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Clip template</label>
            <p className="text-xs text-muted-foreground -mt-1">
              Controls subtitles, layout, aspect ratio, and more.{" "}
              <a href="/dashboard/templates" className="underline underline-offset-2 hover:text-foreground">
                Manage templates
              </a>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allTemplates.map((tpl) => {
                const selected = selectedTemplateId === tpl.id
                const ar = tpl.config.aspectRatio
                // Small CSS preview boxes for aspect ratio (minor polish: better token contrast)
                const previewStyle: React.CSSProperties =
                  ar === "9:16"
                    ? { width: 15, height: 26 }
                    : ar === "1:1"
                    ? { width: 22, height: 22 }
                    : { width: 28, height: 16 }
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    disabled={isLoading}
                    title={tpl.name + (tpl.description ? ` — ${tpl.description}` : "")}
                    className={`relative flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/60 ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    {selected && (
                      <CheckIcon className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
                    )}
                    {/* Mini visual aspect ratio indicator */}
                    <div className="flex items-center gap-2">
                      <div
                        className="shrink-0 rounded-sm border border-muted-foreground/30 bg-muted/70"
                        style={previewStyle}
                        aria-hidden
                      />
                      <span className="text-sm font-medium pr-4 truncate">{tpl.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ar} · {tpl.config.subtitles.enabled ? tpl.config.subtitles.style : "no subs"}
                    </span>
                    {!tpl.isSystem && (
                      <Badge variant="secondary" className="mt-0.5 w-fit text-xs py-0">Custom</Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
