"use client"

import { useMemo, useSyncExternalStore } from "react"

import { parseUser, readSession, subscribeSession, type Role } from "@/lib/api"

export const roleHome = (role: Role) => (role === "admin" ? "/courses" : "/feed")

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
