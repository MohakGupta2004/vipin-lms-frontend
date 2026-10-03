"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { roleHome, useUser } from "@/hooks/use-user"

// Old landing route: send everyone to the home screen for their role.
export default function DashboardPage() {
  const router = useRouter()
  const user = useUser()
  useEffect(() => {
    if (user === undefined) return
    router.replace(user ? roleHome(user.role) : "/login")
  }, [user, router])
  return null
}
