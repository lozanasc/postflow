import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { SYSTEM_TEMPLATES } from "@/lib/template-types"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userTemplates = await db.clipTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ system: SYSTEM_TEMPLATES, user: userTemplates })
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, description, config } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!config) return NextResponse.json({ error: "Config is required" }, { status: 400 })

  const template = await db.clipTemplate.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() ?? "",
      config,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
