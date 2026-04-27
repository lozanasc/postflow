import { UploadForm } from "@/components/upload/upload-form"

export default function UploadPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <h1 className="text-2xl font-semibold">New Upload</h1>
        <p className="text-muted-foreground">Upload a raw video or paste a YouTube link to start processing.</p>
      </div>
      <UploadForm />
    </div>
  )
}
