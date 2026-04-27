import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const job = await db.job.findFirst({ where: { id, userId: session.user.id } })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (job.status === "completed") {
    return NextResponse.json({ error: "Job already completed" }, { status: 400 })
  }

  await db.job.update({
    where: { id },
    data: { status: "failed", error: "Cancelled by user" },
  })

  return NextResponse.json({ ok: true })
}
