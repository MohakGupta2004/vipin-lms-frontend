"use client"

import { BookOpenTextIcon, CardsIcon, CaretUpDownIcon, ChartLineUpIcon, CompassIcon, ListChecksIcon, NewspaperIcon, NotePencilIcon, PlayCircleIcon, SignOutIcon, SquaresFourIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Brand } from "@/components/brand"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { roleHome, useUser } from "@/hooks/use-user"
import { ApiError, getMe, isSessionFresh, logout, markSessionVerified, saveUser, type Role, type User } from "@/lib/api"

const NAV: Record<Role, { href: string; label: string; icon: Icon }[]> = {
  admin: [
    { href: "/courses", label: "All courses", icon: BookOpenTextIcon },
    { href: "/feed", label: "My courses", icon: NewspaperIcon },
    { href: "/enrollments", label: "Enrollments", icon: UsersIcon },
  ],
  instructor: [
    { href: "/feed", label: "My classroom", icon: NewspaperIcon },
    { href: "/explore", label: "Explore", icon: CompassIcon },
  ],
  student: [
    { href: "/feed", label: "Dashboard", icon: SquaresFourIcon },
    { href: "/learn", label: "Learn Your Way", icon: PlayCircleIcon },
    { href: "/practice", label: "Practice & Prepare", icon: ListChecksIcon },
    { href: "/flashcards", label: "Flashcards", icon: CardsIcon },
    { href: "/notes", label: "Notes", icon: NotePencilIcon },
    { href: "/progress", label: "Track Your Progress", icon: ChartLineUpIcon },
    { href: "/explore", label: "Explore", icon: CompassIcon },
  ],
}

// The server is the source of truth for who is signed in and their role.
// The cached profile in local storage lets the page render instantly; it is periodically verified and refreshed in the background.
function useVerifiedSession(userId: string | undefined) {
  const [verifiedFor, setVerifiedFor] = useState<string | null>(() => userId ?? null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const verify = () => {
      getMe()
        .then((me) => {
          markSessionVerified()
          saveUser(me) // picks up a changed role or name
          if (!cancelled) setVerifiedFor(me.id)
        })
        .catch((e) => {
          // If offline or non-401 network issue: keep cached session.
          // 401 calls clearUser() inside call() which triggers re-render via useUser() -> sign out.
          if (!(e instanceof ApiError && e.status === 401) && !cancelled) {
            setVerifiedFor(userId)
          }
        })
    }

    if (!isSessionFresh()) {
      verify()
    } else {
      setVerifiedFor(userId)
    }

    // Keep session active in the background by refreshing/verifying every 4 minutes (well before 14m expiry)
    const interval = setInterval(() => {
      verify()
    }, 4 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [userId])

  return !!userId && verifiedFor === userId
}

/**
 * Page frame + client-side route guard. The UI only shows what a role can do;
 * the API enforces the same rules on the server, so this is a convenience, not the security boundary.
 */
export function AppShell({
  roles,
  bare,
  children,
}: {
  roles?: Role[]
  /** Guard only, no header/footer/container: for full-bleed pages like the video player. */
  bare?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const verified = useVerifiedSession(user?.id)
  const allowed = !!user && (!roles || roles.includes(user.role))
  useEffect(() => {
    if (user === undefined) return // still hydrating
    if (!user) router.replace("/login")
    else if (!allowed && verified) router.replace(roleHome(user.role))
  }, [user, allowed, verified, router])

  if (!user || !allowed || !verified) return null
  if (bare) return children

  const signOut = async () => {
    await logout().catch(() => {})
    router.replace("/login")
  }

  return (
    <SidebarProvider defaultOpen={readSidebarOpen()}>
      <AppSidebar user={user} pathname={pathname} onSignOut={signOut} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-center" />
          <Link href={roleHome(user.role)} aria-label="Home" className="md:hidden">
            <Brand compact className="[&>div]:size-7" />
          </Link>
          <span className="hidden truncate text-sm text-muted-foreground md:block">{pageName(user.role, pathname)}</span>
        </header>
        <div className="mx-auto w-full max-w-[1120px] flex-1 space-y-10 px-5 py-9 sm:px-8 lg:px-12 lg:py-12">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** The sidebar remembers being collapsed (the shadcn sidebar writes this cookie on every toggle). */
function readSidebarOpen() {
  if (typeof document === "undefined") return true
  return !document.cookie.split("; ").includes("sidebar_state=false")
}

function pageName(role: Role, pathname: string) {
  return NAV[role].find((n) => pathname.startsWith(n.href))?.label ?? ""
}

function AppSidebar({ user, pathname, onSignOut }: { user: User; pathname: string; onSignOut: () => void }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Link href={roleHome(user.role)} aria-label="Home" className="flex items-center" onClick={() => setOpenMobile(false)}>
          <Brand compact className="[&>div]:size-8 group-data-[collapsible=icon]:[&>span]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV[user.role].map(({ href, label, icon: NavIcon }) => {
                const active = pathname.startsWith(href)
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      className="h-9 text-[14px] data-active:bg-white data-active:shadow-[0_1px_2px_rgba(16,42,67,0.08),0_0_0_1px_rgba(16,42,67,0.06)] [&_svg]:size-[18px]"
                      render={<Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)} />}
                    >
                      <NavIcon weight={active ? "fill" : "regular"} className={active ? "text-primary" : "text-gray-500"} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-navy text-[13px] font-medium text-white">
                        {user.firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-[13px] font-medium text-heading">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground capitalize">{user.role}</span>
                    </span>
                    <CaretUpDownIcon className="ml-auto text-gray-400" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-medium text-heading">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <SignOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-7">
      <div className="max-w-2xl space-y-2.5">
        <h1 className="display text-[2.375rem] leading-[1.05] text-heading sm:text-[2.875rem]">{title}</h1>
        {subtitle && <p className="text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </p>
  )
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong")
