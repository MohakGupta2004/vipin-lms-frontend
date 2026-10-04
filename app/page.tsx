"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { roleHome, useUser } from "@/hooks/use-user"

// Send logged-in users to their home screen, everyone else to the login page.
export default function Page() {
  const router = useRouter()
  const user = useUser()
  useEffect(() => {
    if (user === undefined) return
    router.replace(user ? roleHome(user.role) : "/login")
  }, [user, router])
  return null
}
