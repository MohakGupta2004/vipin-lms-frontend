"use client"

import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
  Loader2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError, login, register, saveUser } from "@/lib/api"

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isSignup = mode === "signup"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email")).trim()
    const password = String(form.get("password"))

    setLoading(true)
    try {
      const user = isSignup
        ? await register({
            firstName: String(form.get("firstName")).trim(),
            lastName: String(form.get("lastName")).trim(),
            email,
            password,
          })
        : await login(email, password)
      saveUser(user)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-gray-100 bg-gray-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-200/50 blur-3xl" />

        <Brand className="relative" />

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
              Learn at your own pace, grow without limits.
            </h2>
            <p className="text-gray-600">
              Courses, progress tracking and community — all in one clean workspace.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: BookOpen, text: "Structured courses from expert instructors" },
              { icon: BarChart3, text: "Track your progress at a glance" },
              { icon: Users, text: "Learn together with a supportive community" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-indigo-600 shadow-xs">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-gray-500">© {new Date().getFullYear()} LMS Platform</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col items-center justify-center gap-8 p-6 sm:p-12">
        <Brand className="lg:hidden" />

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-gray-500">
              {isSignup
                ? "Sign up to start learning today."
                : "Enter your details to access your courses."}
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isSignup && (
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="firstName">First name</FieldLabel>
                    <Input id="firstName" name="firstName" placeholder="Jane" required className="h-10 bg-white" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                    <Input id="lastName" name="lastName" placeholder="Doe" required className="h-10 bg-white" />
                  </Field>
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="h-10 bg-white"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="h-10 bg-white pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 transition-colors hover:text-gray-900"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-10 w-full bg-gray-900 text-white shadow-sm hover:bg-gray-800"
              >
                {loading && <Loader2 className="animate-spin" />}
                {isSignup ? "Create account" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>

          <p className="text-center text-sm text-gray-500">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="ml-1 font-medium text-gray-900 underline-offset-4 hover:underline"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
