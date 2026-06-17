import { UploadForm } from "@/components/upload/upload-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

export default function UploadPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <PageHeader
        title="New Upload"
        description="Upload a raw video or paste a YouTube link to start processing."
      >
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" />
          Back to Dashboard
        </Button>
      </PageHeader>
      <UploadForm />
    </div>
  )
}
