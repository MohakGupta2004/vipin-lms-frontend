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
  StudentIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr"
import type { Icon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { Brand, BrandMark } from "@/components/brand"
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
    { href: "/students", label: "Students", short: "Students", icon: StudentIcon },
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
    { href: "/students", label: "Students", short: "Students", icon: StudentIcon },
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
          <span className="hidden truncate text-sm font-medium tracking-[-0.01em] text-heading/70 md:block">
            {deskNav(user.role, pathname)?.label}
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
        <DropdownMenuItem onClick={onSignOut} className="min-h-11 rounded-xl px-2 text-[15px] text-red-600 focus:text-red-600 [&_svg]:text-red-600">
          <SignOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const FOCUSED = /^\/(quizzes\/|flashcards\/study)/

/**
 * Apple's spring, by damping ratio and response (seconds): progress 0→1 at t seconds, and its velocity,
 * for a start velocity v0 given in whole-distances per second. A touch under critical damping, so the pill
 * settles with the faintest give, like the iOS tab bar's.
 */
function spring(t: number, v0: number, damping = 0.82, response = 0.42) {
  const w = (2 * Math.PI) / response
  const zw = damping * w
  const wd = w * Math.sqrt(1 - damping * damping)
  const b = (v0 - zw) / wd
  const e = Math.exp(-zw * t)
  const c = Math.cos(wd * t)
  const s = Math.sin(wd * t)
  const y = e * (-c + b * s)
  return { p: 1 + y, v: -zw * y + e * (wd * s + b * wd * c) }
}

// The pill's flight, in tabs. It lives outside React because the shell remounts with every page: the next
// dock reads where the pill is right now, mid-flight or not, and carries on from there at the same speed.
let flight: { from: number; to: number; v0: number; t0: number; ms: number } | null = null

function pillNow(now: number) {
  if (!flight) return null
  const t = Math.min(now - flight.t0, flight.ms) / 1000
  const { p, v } = t * 1000 >= flight.ms ? { p: 1, v: 0 } : spring(t, flight.v0)
  const d = flight.to - flight.from
  return { at: flight.from + d * p, speed: d * v }
}

const linearOk = () => typeof CSS !== "undefined" && CSS.supports("transition-timing-function", "linear(0, 1)")

/** Sends the dock's selection pill to `to`, from wherever it is on screen, keeping its momentum. */
function glidePill(el: HTMLElement, to: number) {
  el.getAnimations().forEach((a) => a.cancel())
  const now = performance.now()
  const cur = pillNow(now)
  const place = (i: number) => `translateX(${i * 100}%)`
  if (to < 0) {
    flight = null
    el.style.opacity = "0"
    return
  }
  el.style.transform = place(to)
  const fadeIn = el.style.opacity !== "1"
  el.style.opacity = "1"
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
  // First sight of the pill, or a calmer setting: it simply appears where it belongs.
  if (!cur || reduced || Math.abs(to - cur.at) < 0.001) {
    flight = { from: to, to, v0: 0, t0: now, ms: 0 }
    if (fadeIn) el.animate({ opacity: [0, 1] }, { duration: 180, easing: "ease-out" })
    return
  }
  const dist = to - cur.at
  const v0 = cur.speed / dist
  // Sample the spring into a linear() curve and stop once it is at rest.
  const pts: string[] = []
  let ms = 0
  for (let t = 0; t < 1.5; t += 1 / 60) {
    const { p, v } = spring(t, v0)
    pts.push(p.toFixed(4))
    ms = t * 1000
    if (t > 0.1 && Math.abs(1 - p) < 0.001 && Math.abs(v) < 0.01) break
  }
  pts[pts.length - 1] = "1"
  flight = { from: cur.at, to, v0, t0: now, ms }
  el.animate(
    { transform: [place(cur.at), place(to)] },
    { duration: ms, easing: linearOk() ? `linear(${pts.join(", ")})` : "cubic-bezier(0.32, 0.72, 0, 1)" }
  )
  // While it travels the pill stretches along its path, longer for a longer trip, then gathers itself
  // back into a capsule as it lands: the liquid feel of a selection that has weight.
  const stretch = 1 + Math.min(0.28, 0.1 + 0.06 * Math.abs(dist))
  el.animate(
    { transform: ["scaleX(1)", `scaleX(${stretch}) scaleY(0.94)`, "scale(1)"], offset: [0, 0.32, 1] },
    { duration: Math.min(ms, 520), easing: "cubic-bezier(0.25, 1, 0.5, 1)", composite: "add" }
  )
}

// Every tab shows at once when each still gets a comfortable touch target. On a narrower phone five whole
// tabs show and the strip scrolls, a tab at a time, to the rest; a tab is never left cut in half.
const DOCK_FIT = 5
const DOCK_MIN_TAB = 56

// How far the strip was scrolled on the previous page, so the dock comes back exactly as it was left.
let dockScroll = 0

/**
 * Phones: every destination floats under the thumb in a glass capsule, like a native tab bar. When there
 * are more than five, the capsule becomes a strip that scrolls to the right. Hidden from md, where the
 * sidebar takes over.
 */
function TabBar({ role, pathname }: { role: Role; pathname: string }) {
  const tabs = NAV[role]
  const scrolls = tabs.length > DOCK_FIT
  const fit = Math.min(tabs.length, DOCK_FIT)
  const activeIdx = tabs.findIndex((t) => pathname.startsWith(t.href))

  // A tap selects the tab at once; the route catches up after. A real navigation clears it.
  const [pressed, setPressed] = useState<number | null>(null)
  const [seen, setSeen] = useState(activeIdx)
  if (seen !== activeIdx) {
    setSeen(activeIdx)
    setPressed(null)
  }
  const selected = pressed ?? activeIdx
  const pillRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    if (pillRef.current) glidePill(pillRef.current, selected)
  }, [selected])

  // Before the first paint, put the strip back where it was, then bring the current tab into view if it is
  // off the edge. The pill and the strip travel together, so the eye follows one motion, not two.
  const stripRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip || !scrolls) return
    const size = () => {
      const all = strip.clientWidth / tabs.length >= DOCK_MIN_TAB
      strip.style.setProperty("--across", String(all ? tabs.length : DOCK_FIT))
      fadeEdges(strip)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(strip)
    return () => ro.disconnect()
  }, [scrolls, tabs.length])
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollLeft = dockScroll
    fadeEdges(strip)
    const tab = strip.querySelectorAll<HTMLElement>("a")[selected]
    if (!tab) return
    const left = tab.offsetLeft
    const right = left + tab.offsetWidth
    const view = strip.clientWidth
    let to = strip.scrollLeft
    if (left < to) to = left
    else if (right > to + view) to = right - view
    if (to !== strip.scrollLeft) {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
      strip.scrollTo({ left: to, behavior: reduced ? "auto" : "smooth" })
    }
  }, [selected])

  const item =
    "group relative z-10 flex w-(--tab) shrink-0 snap-start flex-col items-center justify-center gap-[3px] rounded-full py-1.5 text-[10px] font-semibold tracking-[0.01em] transition-colors duration-200"
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
        <div className="glass rounded-full p-1">
          <div
            ref={stripRef}
            onScroll={(e) => {
              dockScroll = e.currentTarget.scrollLeft
              fadeEdges(e.currentTarget)
            }}
            style={{ "--across": fit } as React.CSSProperties}
            className={cn(
              "dock-strip @container overflow-hidden rounded-full",
              scrolls && "rail snap-x snap-mandatory overflow-x-auto"
            )}
          >
            <div className="relative flex w-max [--tab:calc(100cqw/var(--across))]">
              <span
                ref={pillRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-(--tab) rounded-full bg-navy/[0.07] opacity-0 will-change-transform"
              />
              {tabs.map(({ href, short, icon: TabIcon }, i) => {
                const active = i === selected
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={i === activeIdx ? "page" : undefined}
                    onClick={() => setPressed(i)}
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
          </div>
        </div>
      </nav>
    </>
  )
}

/**
 * The strip's edges dissolve where more tabs sit beyond them, and the fade grows with how far there is to
 * go, so a hard cut never reads as the end of the dock.
 */
function fadeEdges(strip: HTMLElement) {
  const max = strip.scrollWidth - strip.clientWidth
  const fade = (px: number) => `${Math.max(0, Math.min(16, px))}px`
  strip.style.setProperty("--fade-l", fade(strip.scrollLeft))
  strip.style.setProperty("--fade-r", fade(max - strip.scrollLeft))
}

// Where the sidebar's selection pill sat on the previous page; like the tab bar's, it starts there and travels.
let lastNavPill: { top: number; height: number } | null = null

function useNavPill(pathname: string, sidebarState: string) {
  const ref = useRef<HTMLUListElement>(null)
  const [pill, setPill] = useState<{ top: number; height: number; glide: boolean } | null>(() =>
    lastNavPill ? { ...lastNavPill, glide: false } : null
  )
  useLayoutEffect(() => {
    const li = ref.current?.querySelector<HTMLElement>("[data-nav-active]")
    const next = li ? { top: li.offsetTop, height: li.offsetHeight } : null
    const from = lastNavPill
    lastNavPill = next
    if (!next) return setPill(null)
    // First appearance lands in place; afterwards it glides from where it was.
    if (!from) return setPill({ ...next, glide: false })
    const raf = requestAnimationFrame(() => setPill({ ...next, glide: true }))
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  // Items change height as the sidebar collapses and expands; once it settles, measure again.
  useEffect(() => {
    const t = setTimeout(() => {
      const li = ref.current?.querySelector<HTMLElement>("[data-nav-active]")
      if (!li) return
      lastNavPill = { top: li.offsetTop, height: li.offsetHeight }
      setPill({ ...lastNavPill, glide: false })
    }, 420)
    return () => clearTimeout(t)
  }, [sidebarState])
  return [ref, pill] as const
}

// Pages that aren't in the sidebar themselves belong to one that is, so the sidebar always says where you are.
const PARENT: Record<Role, string> = { admin: "/courses", instructor: "/feed", student: "/learn" }

/** Desktop: the sidebar item for this page, or for the section a sub-page (a course, a test) lives under. */
function deskNav(role: Role, pathname: string) {
  const direct = NAV[role].find((n) => pathname.startsWith(n.href))
  if (direct) return direct
  if (/^\/(courses|quizzes|flashcards)/.test(pathname)) return NAV[role].find((n) => n.href === PARENT[role])
  return undefined
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
  const { isMobile, setOpenMobile, state } = useSidebar()
  const [navRef, pill] = useNavPill(pathname, state)
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
  const current = deskNav(user.role, pathname)?.href
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-5 group-data-[collapsible=icon]:px-2">
        <Link
          href={roleHome(user.role)}
          aria-label="Home"
          className="flex min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 group-data-[collapsible=icon]:justify-center"
          onClick={() => setOpenMobile(false)}
        >
          <span className="size-8 shrink-0 rounded-full">
            <BrandMark />
          </span>
          <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-heading">Vipin Garg</span>
            <span className="truncate text-[12px] text-heading/45">Finance Coach</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-1">
        <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu ref={navRef} className="relative gap-0.5">
              {/* The selection is one white pill that glides from the last page's item to this one. */}
              <li
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 rounded-[10px] bg-primary/[0.08] group-data-[collapsible=icon]:hidden",
                  pill?.glide && "transition-[transform,height,opacity] duration-500 ease-(--ease-drawer)"
                )}
                style={{
                  height: pill?.height ?? 0,
                  transform: `translateY(${pill?.top ?? 0}px)`,
                  opacity: pill ? 1 : 0,
                }}
              />
              {NAV[user.role].map(({ href, label, icon: NavIcon }) => {
                const active = href === current
                return (
                  <SidebarMenuItem key={href} data-nav-active={active || undefined}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      className={cn(
                        "relative h-9 gap-3 rounded-[10px] px-3 text-[14px] font-medium text-heading/70 transition-colors duration-150 pointer-coarse:h-11 pointer-coarse:text-[15px] hover:bg-black/[0.04] hover:text-heading active:bg-black/[0.06] [&_svg]:size-[18px]",
                        "data-active:bg-transparent data-active:font-semibold data-active:text-primary data-active:hover:bg-transparent",
                        "group-data-[collapsible=icon]:data-active:bg-primary/[0.08]"
                      )}
                      render={
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      {/* Quiet gray icons; the current page's turns accent and fills in. */}
                      <NavIcon weight={active ? "fill" : "regular"} className={active ? "text-primary" : "text-heading/45"} />
                      <span className="truncate">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="h-12 gap-2.5 rounded-xl bg-black/[0.03] px-2.5 hover:bg-black/[0.05] active:bg-black/[0.07] data-popup-open:bg-black/[0.06] group-data-[collapsible=icon]:bg-transparent"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-gradient-to-b from-[#3a5f86] to-navy text-[13px] font-semibold text-white">
                        {user.firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-heading">
                        <span className="truncate">
                          {user.firstName} {user.lastName}
                        </span>
                        {tier && (
                          <Badge variant="outline" className="h-4 shrink-0 border-black/10 px-1.5 text-[10px] font-semibold text-heading/60">
                            {TIER_LABEL[tier]}
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-[11.5px] text-heading/45 capitalize">{user.role}</span>
                    </span>
                    <CaretUpDownIcon className="ml-auto size-3.5 text-heading/35" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="w-60 p-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-2 font-normal">
                    <span className="block truncate text-[13px] font-semibold text-heading">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut} className="h-8 px-2.5">
                  <SignOutIcon />
                  Sign Out
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
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  /** The parent page, shown as a link above the title. */
  back?: { href: string; label: string }
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-1 sm:border-b sm:border-border sm:pb-7 md:border-b-0 md:pb-2">
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
        <h1 className="display text-[2rem] leading-[1.1] font-bold text-heading sm:text-[2.875rem] sm:font-semibold md:text-[2.75rem] md:leading-[1.08] md:font-semibold">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[15px] leading-snug text-muted-foreground sm:leading-relaxed md:text-[17px] md:tracking-[-0.01em]">
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
