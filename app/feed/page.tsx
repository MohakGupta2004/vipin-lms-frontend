"use client"

import { ArrowRight, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/use-user"
import {
  UUID_RE,
  createPost,
  deletePost,
  listPosts,
  loadKnownCourses,
  rememberCourses,
  type KnownCourse,
  type Post,
} from "@/lib/api"

export default function FeedPage() {
  return (
    <AppShell roles={["instructor", "student"]}>
      <Feed />
    </AppShell>
  )
}

function Feed() {
  const user = useUser()!
  const isInstructor = user.role === "instructor"
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [courses, setCourses] = useState<KnownCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courseId, setCourseId] = useState("")

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await listPosts(50, 0)
      setPosts(rows)
      rememberCourses(rows.map((p) => ({ id: p.courseId, title: p.courseTitle })))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setCourses(loadKnownCourses())
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function openCourse(e: React.FormEvent) {
    e.preventDefault()
    const id = courseId.trim()
    if (!UUID_RE.test(id)) return setError("Course ID must be a valid ID.")
    rememberCourses([{ id, title: "" }])
    router.push(`/courses/${id}`)
  }

  return (
    <>
      <PageTitle
        title={isInstructor ? "My classroom" : "My learning"}
        subtitle={
          isInstructor
            ? "Courses you teach and the announcements you have shared."
            : "Your courses and the latest updates from your instructors."
        }
      />

      <ErrorNote error={error} />

      <Card className="bg-white shadow-xs">
        <CardHeader>
          <CardTitle>Courses</CardTitle>
          <CardDescription>
            Courses appear here once they show up in your feed. You can also open one with its course ID
            (ask your administrator).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {courses.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    <span className="truncate">{c.title || c.id}</span>
                    <ArrowRight className="size-4 shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={openCourse} className="flex gap-2">
            <Input
              aria-label="Course ID"
              placeholder="Paste a course ID"
              value={courseId}
              className="h-10 bg-white font-mono"
              onChange={(e) => setCourseId(e.target.value)}
            />
            <Button type="submit" variant="outline" className="h-10">
              Open
            </Button>
          </form>
        </CardContent>
      </Card>

      {isInstructor && <NewPost courses={courses} onPosted={load} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Feed</h2>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {!loading && posts.length === 0 && <p className="text-sm text-gray-500">No posts yet.</p>}
        {posts.map((p) => (
          <Card key={p.id} className="bg-white shadow-xs">
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-gray-500">
                  <span className="font-medium text-gray-800">{p.authorName}</span> in{" "}
                  <Link href={`/courses/${p.courseId}`} className="underline-offset-4 hover:underline">
                    {p.courseTitle}
                  </Link>{" "}
                  · {new Date(p.createdAt).toLocaleString()}
                </div>
                {isInstructor && p.authorId === user.id && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete post"
                    onClick={async () => {
                      if (!confirm("Delete this post?")) return
                      try {
                        await deletePost(p.id)
                        setPosts((x) => x.filter((y) => y.id !== p.id))
                      } catch (e) {
                        setError(errMsg(e))
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              {/* Rendered as text, never as HTML. */}
              <p className="text-sm whitespace-pre-wrap text-gray-800">{p.content}</p>
              {p.links && p.links.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {p.links.map((l) => (
                    <li key={l}>
                      <a
                        href={l}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="break-all text-indigo-600 underline-offset-4 hover:underline"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  )
}

function NewPost({ courses, onPosted }: { courses: KnownCourse[]; onPosted: () => void }) {
  const [courseId, setCourseId] = useState("")
  const [content, setContent] = useState("")
  const [links, setLinks] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!courseId) return setError("Choose a course.")
    setSaving(true)
    try {
      await createPost({
        courseId,
        content: content.trim(),
        links: links.split("\n").map((l) => l.trim()).filter(Boolean),
      })
      setContent("")
      setLinks("")
      onPosted()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-white shadow-xs">
      <CardHeader>
        <CardTitle>Post an update</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="pcourse">Course</FieldLabel>
            <Select id="pcourse" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.id}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pcontent">Message</FieldLabel>
            <Textarea id="pcontent" required value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="plinks">Links (one per line, http or https)</FieldLabel>
            <Textarea id="plinks" className="min-h-14" value={links} onChange={(e) => setLinks(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Post
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
