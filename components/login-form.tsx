"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn, signUp } from "@/lib/auth-client"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "login") {
        const res = await signIn.email({ email, password })
        if (res.error) throw new Error(res.error.message)
      } else {
        const res = await signUp.email({ email, password, name })
        if (res.error) throw new Error(res.error.message)
      }
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await signIn.social({ provider: "google", callbackURL: "/dashboard" })
    } catch (err) {
      setError("Google sign in failed. Please try again.")
      setLoading(false)
    }
  }

  const isLogin = mode === "login"

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {/* Elegant mode switch at the top */}
      <div className="mb-8 flex rounded-full border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => { setMode("login"); setError(null) }}
          className={cn(
            "flex-1 rounded-full py-1.5 text-sm font-medium transition-all",
            isLogin 
              ? "bg-white text-zinc-950 shadow" 
              : "text-zinc-400 hover:text-white"
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setError(null) }}
          className={cn(
            "flex-1 rounded-full py-1.5 text-sm font-medium transition-all",
            !isLogin 
              ? "bg-white text-zinc-950 shadow" 
              : "text-zinc-400 hover:text-white"
          )}
        >
          Create account
        </button>
      </div>

      {/* Headline */}
      <div className="mb-7">
        <div className="text-[27px] font-semibold tracking-[-1.2px] text-white">
          {isLogin ? "Welcome back" : "Get started"}
        </div>
        <p className="mt-1 text-[15px] text-zinc-400">
          {isLogin 
            ? "Sign in to continue creating and scheduling clips." 
            : "Create your account in seconds. No credit card needed."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.5px] text-zinc-400">Full name</div>
            <Input
              type="text"
              placeholder="Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 border-white/10 bg-zinc-950 text-base placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/10"
            />
          </div>
        )}

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.5px] text-zinc-400">Email address</div>
          <Input
            type="email"
            placeholder="you@creator.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 border-white/10 bg-zinc-950 text-base placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/10"
          />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.5px] text-zinc-400">Password</div>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-11 border-white/10 bg-zinc-950 text-base placeholder:text-zinc-500 focus-visible:border-white/30 focus-visible:ring-white/10"
          />
          {!isLogin && (
            <p className="mt-1.5 text-[11px] text-zinc-500">At least 8 characters</p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          className="mt-2 h-11 w-full bg-white text-base font-semibold text-zinc-950 hover:bg-white/90 active:bg-white/80" 
          disabled={loading}
        >
          {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
        </Button>

        {/* Divider + Google */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-zinc-900 px-3 text-xs tracking-wider text-zinc-500">OR</span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="h-11 w-full border-white/15 bg-transparent text-base font-medium text-white hover:bg-white/5 hover:text-white"
        >
          <div className="mr-2 flex h-4 w-4 items-center justify-center rounded-sm bg-white text-[10px] font-bold text-zinc-900">
            G
          </div>
          Continue with Google
        </Button>

        {/* Subtle footer switch (kept minimal since we have the segmented control) */}
        <p className="pt-3 text-center text-sm text-zinc-400">
          {isLogin ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? "signup" : "login")
              setError(null)
            }}
            className="font-medium text-white underline-offset-4 hover:underline"
          >
            {isLogin ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </form>
    </div>
  )
}
