import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6 text-white md:p-10">
      {/* Rich premium dark background with depth */}
      <div className="absolute inset-0 -z-10">
        {/* Deep base */}
        <div className="absolute inset-0 bg-zinc-950" />
        {/* Subtle radial glow from top */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(163,163,172,0.12)_0%,transparent_55%)]" />
        {/* Very soft diagonal accent */}
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(82,82,91,0.06)_0%,transparent_40%,rgba(63,63,70,0.04)_60%,transparent_100%)]" />
        {/* Fine noise texture for premium feel */}
        <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#52525b_0.6px,transparent_1px)] bg-[length:3px_3px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Branding */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-950">
              <span className="text-xl font-semibold tracking-[-1.5px]">P</span>
            </div>
            <div className="text-4xl font-semibold tracking-[-1.8px]">Postflow</div>
          </div>
          <p className="mt-3 text-balance text-[15px] leading-snug text-zinc-400">
            Turn long videos into scroll-stopping clips.<br /> 
            Schedule them everywhere. Automatically.
          </p>
        </div>

        {/* The actual elevated form card — clean, generous, modern */}
        <div className="rounded-3xl border border-white/10 bg-zinc-900/90 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl md:p-9">
          <LoginForm />
        </div>

        {/* Bottom micro trust line */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] tracking-[1px] text-zinc-500">
            SECURE AUTH • END-TO-END ENCRYPTED
          </div>
        </div>
      </div>

      {/* Subtle corner accent (optional polish) */}
      <div className="pointer-events-none absolute bottom-6 right-6 hidden text-[10px] text-white/20 md:block">
        v0.1
      </div>
    </div>
  )
}
