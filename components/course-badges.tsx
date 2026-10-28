import { LockIcon } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { batchLabel, type Course } from "@/lib/api"

/** "Batch 2.0" on a later batch of a course, and "Private" for the people who manage it. */
export function CourseBatchBadges({
  course,
  showPrivate = false,
}: {
  course: Pick<Course, "batchNumber" | "visibility">
  showPrivate?: boolean
}) {
  const batch = batchLabel(course)
  return (
    <>
      {batch && <Badge variant="tag">Batch {batch}</Badge>}
      {showPrivate && course.visibility === "private" && (
        <Badge variant="outline">
          <LockIcon /> Private
        </Badge>
      )}
    </>
  )
}
