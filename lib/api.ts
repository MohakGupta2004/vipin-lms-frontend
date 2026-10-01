export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  lastLoginAt: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0)
  }

  // Backend returns JSON {status,data|message}, but plain text for malformed payloads.
  const text = await res.text()
  let json: { data?: T; message?: string } | null = null
  try {
    json = JSON.parse(text)
  } catch {}

  if (!res.ok) {
    throw new ApiError(json?.message || text.trim() || "Something went wrong", res.status)
  }
  return json?.data as T
}

export const login = (email: string, password: string) =>
  request<User>("/auth/login", { email, password })

export const register = (input: {
  firstName: string
  lastName: string
  email: string
  password: string
}) => request<User>("/auth/register", input)

export const refreshSession = () => request<string>("/auth/refresh")

export const USER_KEY = "lms_user"

export function saveUser(user: User) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {}
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {}
}
