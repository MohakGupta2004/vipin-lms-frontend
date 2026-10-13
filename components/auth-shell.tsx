import { Brand } from "@/components/brand"

// Two-column layout shared by every signed-out auth screen: brand panel + form panel.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[5fr_6fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Brand onDark />

        <dl className="max-w-md space-y-9">
          {[
            { title: "Learn Your Way", text: "Access recorded courses and instructor-led live classes." },
            { title: "Practice & Prepare", text: "Strengthen your understanding with practice tests, study materials and assessments." },
            { title: "Track Your Progress", text: "Monitor your learning and pick up where you left off." },
          ].map(({ title, text }) => (
            <div key={title} className="space-y-2">
              <dt className="display text-[2rem] leading-tight text-white">{title}</dt>
              <dd className="max-w-sm text-[15px] leading-relaxed text-white/65">{text}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-white/50">© {new Date().getFullYear()} Vipin Garg</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col items-center justify-center gap-8 p-6 sm:p-12">
        <Brand className="lg:hidden" />
        <div className="w-full max-w-sm space-y-6">{children}</div>
      </section>
    </main>
  )
}
