"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { UploadIcon, LinkIcon, FileVideoIcon } from "lucide-react"

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024 // 10 GB

export function UploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<"idle" | "uploading" | "queuing" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleFileUpload() {
    if (!file) return
    setError(null)
    setStatus("uploading")
    setUploadProgress(0)

    try {
      // 1. Get presigned URL from our API
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!presignRes.ok) throw new Error("Failed to get upload URL")
      const { url, key } = await presignRes.json()

      // 2. Upload directly to Wasabi via XHR (for progress tracking)
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

      // 3. Trigger the pipeline
      setStatus("queuing")
      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wasabiKey: key }),
      })
      if (!ingestRes.ok) throw new Error("Failed to start processing")
      const { jobId } = await ingestRes.json()

      setStatus("done")
      router.push(`/dashboard/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStatus("error")
    }
  }

  async function handleYouTubeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!youtubeUrl.trim()) return
    setError(null)
    setStatus("queuing")

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      })
      if (!res.ok) throw new Error("Failed to start processing")
      const { jobId } = await res.json()
      setStatus("done")
      router.push(`/dashboard/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStatus("error")
    }
  }

  const isLoading = status === "uploading" || status === "queuing"

  return (
    <Tabs defaultValue="youtube" className="w-full max-w-2xl">
      <TabsList className="grid w-full grid-cols-2">
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
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={isLoading || !youtubeUrl.trim()}>
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
                  setError("File exceeds 10 GB limit")
                  return
                }
                setFile(f)
                setError(null)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileVideoIcon className="h-10 w-10" />
              {file ? (
                <span className="text-sm font-medium text-foreground">{file.name}</span>
              ) : (
                <span className="text-sm">Click to choose a file or drag and drop</span>
              )}
              {file && (
                <Badge variant="secondary">
                  {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                </Badge>
              )}
            </button>

            {status === "uploading" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Uploading to storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleFileUpload}
              disabled={!file || isLoading}
            >
              {status === "uploading" ? "Uploading..." : status === "queuing" ? "Starting..." : "Process Video"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
