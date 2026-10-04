"use client"

import { ArrowRight, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppShell, ErrorNote, PageTitle, errMsg } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/use-user"
import {
  createPost,
  deletePost,
  listMyCourses,
  listPosts,
  type Course,
  type Post,
} from "@/lib/api"

export default function FeedPage() {
  return (
    <AppShell>
      <Feed />
    </AppShell>
  )
}

function Feed() {
  const user = useUser()!
  // Instructors and admins own courses; students only take them.
  const canTeach = user.role !== "student"
  const [posts, setPosts] = useState<Post[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [c, p] = await Promise.all([listMyCourses(100, 0), listPosts(50, 0)])
      setCourses(c)
      setPosts(p)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const owned = new Set(courses.filter((c) => c.instructorId === user.id).map((c) => c.id))

  return (
    <>
      <PageTitle
        title={canTeach ? "My courses" : "My learning"}
        subtitle={
          canTeach
            ? "Courses you own and the updates you have shared."
            : "Your enrolled courses and the latest updates from your instructors."
        }
      />

      <ErrorNote error={error} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Courses</h2>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {!loading && courses.length === 0 && !error && (
          <Card className="bg-white">
            <CardContent className="py-8 text-center text-sm text-gray-500">
              {canTeach ? "You don't own any courses yet." : "You are not enrolled in any course yet."}
            </CardContent>
          </Card>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/courses/${c.id}`} className="block h-full rounded-xl border border-gray-200 bg-white p-4 shadow-xs hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-900">{c.title}</span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-gray-400" />
                </div>
                {c.shortDescription && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{c.shortDescription}</p>}
                {canTeach && (
                  <Badge variant={c.status === "published" ? "default" : "secondary"} className="mt-3 capitalize">
                    {c.status}
                  </Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {canTeach && owned.size > 0 && <NewPost courses={courses} onPosted={load} />}

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
                {canTeach && owned.has(p.courseId) && (
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

function NewPost({ courses, onPosted }: { courses: Course[]; onPosted: () => void }) {
  const me = useUser()!
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
              {courses.filter((c) => c.instructorId === me.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
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
