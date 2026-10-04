"use client"

import { BookOpen, GraduationCap, LogOut, Newspaper, Users } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Brand } from "@/components/brand"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { roleHome, useUser } from "@/hooks/use-user"
import { ApiError, getMe, isSessionFresh, logout, markSessionVerified, saveUser, type Role } from "@/lib/api"
import { cn } from "@/lib/utils"

const NAV: Record<Role, { href: string; label: string; icon: typeof BookOpen }[]> = {
  admin: [
    { href: "/courses", label: "All courses", icon: BookOpen },
    { href: "/feed", label: "My courses", icon: Newspaper },
    { href: "/enrollments", label: "Enrollments", icon: Users },
  ],
  instructor: [{ href: "/feed", label: "My classroom", icon: Newspaper }],
  student: [{ href: "/feed", label: "My learning", icon: GraduationCap }],
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
export function AppShell({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
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

  return (
    <div className="min-h-svh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-8">
            <Link href={roleHome(user.role)}>
              <Brand />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV[user.role].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100",
                    pathname.startsWith(href) && "bg-gray-100 text-gray-900"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout().catch(() => {})
                router.replace("/login")
              }}
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">{children}</main>
    </div>
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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  )
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong")
