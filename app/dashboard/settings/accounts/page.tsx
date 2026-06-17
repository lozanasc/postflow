"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OldAccountsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/settings/integrations")
  }, [router])
  return <div className="p-8 text-sm text-muted-foreground">Redirecting to Integrations…</div>
}
