"use client"

import { useMemo, useSyncExternalStore } from "react"

import { parseUser, readSession, subscribeSession, type Role } from "@/lib/api"

// Where each role lands after login. Admins land on their dashboard, which also lives at /feed.
const HOME: Record<Role, string> = { admin: "/feed", instructor: "/feed", student: "/feed" }
export const roleHome = (role: Role) => HOME[role]

const noop = () => () => {}

/**
 * The signed-in user from local session storage.
 * `undefined` while hydrating (storage not readable yet), `null` when signed out.
 */
export function useUser() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false)
  const raw = useSyncExternalStore(subscribeSession, readSession, () => null)
  return useMemo(() => (hydrated ? parseUser(raw) : undefined), [hydrated, raw])
}
