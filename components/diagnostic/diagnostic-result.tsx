"use client"

import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { ErrorNote, PageTitle } from "@/components/app-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/** Shown after submitting. The user never sees the score: only admins do. */
export function DiagnosticSubmitted({
  saving,
  saveError,
  onRetry,
}: {
  saving: boolean
  saveError: string | null
  onRetry: () => void
}) {
  if (saveError) {
    return (
      <>
        <PageTitle title="Could not save" subtitle="Your answers are still here. Try again." />
        <ErrorNote error={saveError} />
        <div>
          <Button onClick={onRetry} disabled={saving}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle
        title={saving ? "Saving your answers" : "Diagnostic submitted"}
        subtitle="Your instructor will go through your result with you."
      />
      <Card className="bg-white">
        <CardContent className="flex items-start gap-3">
          <CheckCircleIcon className="mt-0.5 size-6 shrink-0 text-teal" weight="fill" />
          <p className="text-[15px] leading-relaxed text-gray-700">
            Thank you. Your answers are in. Results are shared by your instructor, not shown here.
          </p>
        </CardContent>
      </Card>
      <div>
        <Link href="/feed" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </>
  )
}

/** Shown when this email already took the diagnostic. */
export function DiagnosticAlreadyTaken() {
  return (
    <>
      <PageTitle
        title="Diagnostic already taken"
        subtitle="The diagnostic can be taken only once per email."
      />
      <Card className="bg-white">
        <CardContent className="flex items-start gap-3">
          <WarningCircleIcon className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
          <p className="text-[15px] leading-relaxed text-gray-700">
            You already completed it. Your instructor has your result.
          </p>
        </CardContent>
      </Card>
      <div>
        <Link href="/feed" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </>
  )
}
