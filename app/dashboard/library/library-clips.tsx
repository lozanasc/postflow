"use client"

import { ClipCard } from "@/components/jobs/clip-card"

interface Clip {
  id: string
  wasabiUrl: string
  duration: number
  viralityScore: number
  hookText: string
  layout: string
  approved: boolean
  start: number
  end: number
}

export function LibraryClips({ clips }: { clips: Clip[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {clips.map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          onApprove={() => {}}
          onSchedule={() => {}}
        />
      ))}
    </div>
  )
}
