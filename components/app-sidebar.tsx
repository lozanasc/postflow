"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  UploadIcon,
  LibraryIcon,
  CalendarIcon,
  BarChart2Icon,
  Settings2Icon,
  ZapIcon,
  Share2Icon,
  VideoIcon,
  AtSignIcon,
} from "lucide-react"

const data = {
  teams: [
    {
      name: "Postflow",
      logo: <ZapIcon />,
      plan: "Pro",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: true,
      items: [],
    },
    {
      title: "Upload",
      url: "/dashboard/upload",
      icon: <UploadIcon />,
      items: [],
    },
    {
      title: "Jobs",
      url: "/dashboard/jobs",
      icon: <VideoIcon />,
      items: [],
    },
    {
      title: "Library",
      url: "/dashboard/library",
      icon: <LibraryIcon />,
      items: [
        { title: "All Clips", url: "/dashboard/library" },
        { title: "Post-Cuts", url: "/dashboard/library/post-cuts" },
        { title: "Short-form Bits", url: "/dashboard/library/bits" },
      ],
    },
    {
      title: "Calendar",
      url: "/dashboard/calendar",
      icon: <CalendarIcon />,
      items: [],
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: <BarChart2Icon />,
      items: [],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <Settings2Icon />,
      items: [
        { title: "General", url: "/dashboard/settings" },
        { title: "Connected Accounts", url: "/dashboard/settings/accounts" },
        { title: "Billing", url: "/dashboard/settings/billing" },
      ],
    },
  ],
  projects: [
    {
      name: "Instagram / TikTok",
      url: "/dashboard/settings/accounts",
      icon: <Share2Icon />,
    },
    {
      name: "YouTube",
      url: "/dashboard/settings/accounts",
      icon: <VideoIcon />,
    },
    {
      name: "X (Twitter)",
      url: "/dashboard/settings/accounts",
      icon: <AtSignIcon />,
    },
  ],
}

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: { name: string; email: string; avatar: string } }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
