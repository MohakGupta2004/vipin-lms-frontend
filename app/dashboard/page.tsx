"use client"

import { CheckCircle2, LogOut, Mail, RefreshCw, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import { Brand } from "@/components/brand"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { USER_KEY, clearUser, loadUser, refreshSession, type User } from "@/lib/api"

export default function DashboardPage() {
  const router = useRouter()
  const raw = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem(USER_KEY),
    () => null
  )
  const user = raw ? (JSON.parse(raw) as User) : null
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!loadUser()) router.replace("/login")
  }, [router, raw])

  async function onRefresh() {
    setRefreshing(true)
    try {
      setMessage({ ok: true, text: await refreshSession() })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Refresh failed" })
    } finally {
      setRefreshing(false)
    }
  }

  function onSignOut() {
    // Backend has no logout endpoint yet, so this only clears local state.
    clearUser()
    router.replace("/login")
  }

  if (!user) return null

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()

  return (
    <div className="min-h-svh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Brand />
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Welcome back, {user.firstName}
          </h1>
          <p className="text-sm text-gray-500">Here&apos;s an overview of your account.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-white shadow-xs">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 font-medium text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle>
                    {user.firstName} {user.lastName}
                  </CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {user.role}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="size-4 text-gray-400" />
                {user.email}
              </div>
              <div className="text-xs text-gray-500">
                Last login {new Date(user.lastLoginAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-indigo-600" />
                Session
              </CardTitle>
              <CardDescription>
                Renew your access token without signing in again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {message && (
                <Alert variant={message.ok ? "default" : "destructive"}>
                  <CheckCircle2 />
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}
              <Button variant="outline" onClick={onRefresh} disabled={refreshing} className="w-full">
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
                Refresh token
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
