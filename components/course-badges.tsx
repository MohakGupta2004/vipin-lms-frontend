import { LockIcon } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { batchLabel, type Course } from "@/lib/api"

/** "Batch 2.0" on a later batch of a course, for instructors and admins, and "Private" for the people who manage it. */
export function CourseBatchBadges({
  course,
  showBatch = false,
  showPrivate = false,
}: {
  course: Pick<Course, "batchNumber" | "visibility">
  showBatch?: boolean
  showPrivate?: boolean
}) {
  const batch = showBatch && batchLabel(course)
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
