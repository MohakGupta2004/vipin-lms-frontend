"use client"

import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  CardsIcon,
  CaretUpDownIcon,
  ChartLineUpIcon,
  CompassIcon,
    ListChecksIcon,
  NewspaperIcon,
  NotePencilIcon,
  PlayCircleIcon,
  SignOutIcon,
  SquaresFourIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Brand } from "@/components/brand"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"
import {
  ApiError,
  TIER_LABEL,
  TIER_ORDER,
  getMe,
  isSessionFresh,
  listMyCourses,
  logout,
  markSessionVerified,
  saveUser,
  type Role,
  type Tier,
  type User,
} from "@/lib/api"

// `short` names the destination in the phone tab bar, where a label gets one word.
const NAV: Record<
  Role,
  { href: string; label: string; short: string; icon: Icon }[]
> = {
  admin: [
    {
      href: "/courses",
      label: "All courses",
      short: "Courses",
      icon: BookOpenTextIcon,
    },
    { href: "/feed", label: "My courses", short: "Mine", icon: NewspaperIcon },
    {
      href: "/enrollments",
      label: "Enrollments",
      short: "Enrollments",
      icon: UsersIcon,
    },
  ],
  instructor: [
    {
      href: "/feed",
      label: "My classroom",
      short: "Classroom",
      icon: NewspaperIcon,
    },
    {
      href: "/explore",
      label: "Explore courses",
      short: "Explore",
      icon: CompassIcon,
    },
  ],
  student: [
    { href: "/feed", label: "Dashboard", short: "Home", icon: SquaresFourIcon },
    {
      href: "/learn",
      label: "Learn Your Way",
      short: "Learn",
      icon: PlayCircleIcon,
    },
    {
      href: "/practice",
      label: "Practice & Prepare",
      short: "Practice",
      icon: ListChecksIcon,
    },
    {
      href: "/flashcards",
      label: "Flashcards",
      short: "Cards",
      icon: CardsIcon,
    },
    { href: "/notes", label: "Notes", short: "Notes", icon: NotePencilIcon },
    {
      href: "/progress",
      label: "Track Your Progress",
      short: "Progress",
      icon: ChartLineUpIcon,
    },
    {
      href: "/explore",
      label: "Explore courses",
      short: "Explore",
      icon: CompassIcon,
    },
  ],
}

// The server is the source of truth for who is signed in and their role.
// The cached profile in local storage lets the page render instantly; it is periodically verified and refreshed in the background.
function useVerifiedSession(userId: string | undefined) {
  const [verifiedFor, setVerifiedFor] = useState<string | null>(
    () => userId ?? null
  )

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
    const interval = setInterval(
      () => {
        verify()
      },
      4 * 60 * 1000
    )

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
        {/* The bar's height grows by the notch inset, so its 3.5rem row is never squeezed. On phones it is a
            translucent material that the page scrolls under; scroll-bar keeps it clear until content meets it,
            then the brand gives way to the compact page title, as on iOS. */}
        <header className="material scroll-bar sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-black/[0.06] bg-background/75 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 md:border-border md:bg-background/90">
          <SidebarTrigger className="-ml-1 hidden size-8 text-muted-foreground md:flex" />
          <Separator
            orientation="vertical"
            className="hidden md:block data-vertical:h-4 data-vertical:self-center"
          />
          <Link
            href={roleHome(user.role)}
            aria-label="Home"
            className="scroll-brand flex min-h-11 items-center md:hidden"
          >
            <Brand className="[&>div]:size-8 [&>span]:hidden" />
          </Link>
          <span
            aria-hidden="true"
            className="scroll-title pointer-events-none absolute inset-x-16 bottom-0 flex h-14 items-center justify-center md:hidden"
          >
            <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-heading">
              {pageName(user.role, pathname)}
            </span>
          </span>
          <span className="hidden truncate text-sm text-muted-foreground md:block">
            {pageName(user.role, pathname)}
          </span>
          <AccountButton user={user} onSignOut={signOut} />
        </header>
        <div className="stagger mx-auto w-full max-w-[1120px] flex-1 space-y-8 px-4 pt-3 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:space-y-10 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
          {children}
        </div>
        <TabBar role={user.role} pathname={pathname} />
      </SidebarInset>
    </SidebarProvider>
  )
}

/** The sidebar remembers being collapsed (the shadcn sidebar writes this cookie on every toggle). */
function readSidebarOpen() {
  if (typeof document === "undefined") return true
  return !document.cookie.split("; ").includes("sidebar_state=false")
}

/** Phones: the avatar opens the account menu (who is signed in, sign out); pages live in the dock. */
function AccountButton({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account"
            className="-mr-1.5 ml-auto flex size-11 items-center justify-center rounded-full transition-transform duration-150 ease-(--ease-out) active:scale-90 md:hidden"
          />
        }
      >
        <Avatar className="size-8 shadow-[0_0_0_2px_white,0_2px_8px_-2px_rgba(16,42,67,0.35)]">
          <AvatarFallback className="bg-gradient-to-br from-[#2a5a85] to-navy text-[13px] font-semibold text-white">
            {user.firstName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-64 rounded-2xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
            <Avatar className="size-10">
              <AvatarFallback className="bg-gradient-to-br from-[#2a5a85] to-navy text-[15px] font-semibold text-white">
                {user.firstName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 leading-tight">
              <span className="truncate text-[15px] font-semibold text-heading">
                {user.firstName} {user.lastName}
              </span>
              <span className="truncate text-[13px] text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {offDock(user.role).length > 0 && (
          <>
            <DropdownMenuGroup>
              {offDock(user.role).map(({ href, label, icon: PageIcon }) => (
                <DropdownMenuItem
                  key={href}
                  render={<Link href={href} />}
                  className="min-h-11 rounded-xl px-2 text-[15px] text-heading [&_svg]:size-[18px] [&_svg]:text-gray-500"
                >
                  <PageIcon />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onSignOut} className="min-h-11 rounded-xl px-2 text-[15px] text-red-600 focus:text-red-600 [&_svg]:text-red-600">
          <SignOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The tab the bar showed last. The shell remounts with every page, so this is how the selection pill
// knows where it is coming from and can glide to the new tab instead of jumping.
let lastTab = -1

const FOCUSED = /^\/(quizzes\/|flashcards\/study)/

/** The dock holds five at most: the first four pages, then Explore. */
function dockTabs(role: Role) {
  const nav = NAV[role]
  if (nav.length <= 5) return nav
  const explore = nav.find((n) => n.href === "/explore")
  return explore ? [...nav.slice(0, 4), explore] : nav.slice(0, 5)
}

/** Pages that don't fit in the dock; the account menu lists them so every page stays reachable on phones. */
const offDock = (role: Role) => NAV[role].filter((n) => !dockTabs(role).includes(n))

/**
 * Phones: the main destinations float under the thumb in a glass capsule, like a native tab bar. Up to
 * five fit; with more, the first four stay and "More" opens the full menu. Hidden from md, where the
 * sidebar takes over.
 */
function TabBar({ role, pathname }: { role: Role; pathname: string }) {
  const tabs = dockTabs(role)
  const count = tabs.length
  const activeIdx = tabs.findIndex((t) => pathname.startsWith(t.href))

  // Start the pill where it was on the previous page, then let it travel on the next frame.
  const [pill, setPill] = useState(() => (lastTab >= 0 ? lastTab : activeIdx))
  useEffect(() => {
    lastTab = activeIdx
    const raf = requestAnimationFrame(() => setPill(activeIdx))
    return () => cancelAnimationFrame(raf)
  }, [activeIdx])

  const item =
    "group relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full py-1.5 text-[10px] font-semibold tracking-[0.01em] transition-colors duration-200"
  const icon =
    "size-[24px] transition-transform duration-200 ease-(--ease-out) group-active:scale-[0.82]"
  // Focused tasks (a test in progress, a study session) own the bottom of the screen with their own
  // controls; the dock steps aside, as iOS hides the tab bar on a pushed full-screen task.
  if (FOCUSED.test(pathname)) return null
  return (
    <>
      {/* Scroll edge: content fades into the page colour before it reaches the dock, so only a soft
        wash, not readable text, ever sits behind the glass. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(8.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-background from-55% to-transparent md:hidden"
      />
      <nav
        aria-label="Main"
        className="tab-bar fixed inset-x-3 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-30 md:hidden"
      >
        <div className="glass relative flex rounded-full p-1">
          <div className="pointer-events-none absolute inset-1">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-navy/[0.07] transition-[transform,opacity] duration-500 ease-(--ease-drawer)"
              style={{
                width: `${100 / count}%`,
                transform: `translateX(${Math.max(pill, 0) * 100}%)`,
                opacity: pill < 0 ? 0 : 1,
              }}
            />
          </div>
          {tabs.map(({ href, short, icon: TabIcon }, i) => {
            const active = i === activeIdx
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(item, active ? "text-primary" : "text-gray-500")}
              >
                <TabIcon
                  weight={active ? "fill" : "regular"}
                  className={icon}
                />
                <span className="max-w-full truncate">{short}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function pageName(role: Role, pathname: string) {
  return NAV[role].find((n) => pathname.startsWith(n.href))?.label ?? ""
}

function AppSidebar({
  user,
  pathname,
  onSignOut,
}: {
  user: User
  pathname: string
  onSignOut: () => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  // A student's tier is per course; the sidebar shows the highest one they hold.
  const [tier, setTier] = useState<Tier | null>(null)
  useEffect(() => {
    if (user.role !== "student") return
    listMyCourses(100, 0)
      .then((cs) => {
        const best = cs
          .map((c) => c.tier)
          .filter((t): t is Tier => !!t)
          .sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0]
        setTier(best ?? null)
      })
      .catch(() => {})
  }, [user.role])
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href={roleHome(user.role)}
          aria-label="Home"
          className="flex items-center"
          onClick={() => setOpenMobile(false)}
        >
          <Brand className="[&>div]:size-8 group-data-[collapsible=icon]:[&>span]:hidden" />
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
                      className="h-9 text-[14px] pointer-coarse:h-11 pointer-coarse:text-[15px] data-active:bg-white data-active:shadow-[0_1px_2px_rgba(16,42,67,0.08),0_0_0_1px_rgba(16,42,67,0.06)] [&_svg]:size-[18px]"
                      render={
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <NavIcon
                        weight={active ? "fill" : "regular"}
                        className={active ? "text-primary" : "text-gray-500"}
                      />
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
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-navy text-[13px] font-medium text-white">
                        {user.firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-heading">
                        <span className="truncate">
                          {user.firstName} {user.lastName}
                        </span>
                        {tier && (
                          <Badge
                            variant="lime"
                            className="h-4 shrink-0 px-1.5 text-[10px]"
                          >
                            {TIER_LABEL[tier]}
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {user.role}
                      </span>
                    </span>
                    <CaretUpDownIcon className="ml-auto text-gray-400" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                className="w-60"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-medium text-heading">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
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
  back,
  eyebrow,
}: {
  title: string
  /** A small caps line above the title, like the date over iOS's Today view. */
  eyebrow?: string
  subtitle?: string
  actions?: React.ReactNode
  /** The parent page, shown as a link above the title. */
  back?: { href: string; label: string }
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-1 sm:border-b sm:border-border sm:pb-7">
      <div className="max-w-2xl min-w-0 space-y-2">
        {back && (
          <Link
            href={back.href}
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-teal"
          >
            <ArrowLeftIcon className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="display text-[2rem] leading-[1.1] font-bold text-heading sm:text-[2.875rem] sm:font-semibold">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[15px] leading-snug text-muted-foreground sm:leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </header>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </p>
  )
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong"
