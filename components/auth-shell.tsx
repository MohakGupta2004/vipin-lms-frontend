import { Brand } from "@/components/brand"

// Two-column layout shared by every signed-out auth screen: brand panel + form panel.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[5fr_6fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* Light falling across the panel: two soft glows and a fine highlight along the inner edge. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_0%_0%,hsl(214_60%_32%/0.9),transparent_70%),radial-gradient(60%_50%_at_100%_100%,hsl(180_46%_30%/0.55),transparent_70%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        <Brand onDark white className="relative" />

        <dl className="stagger relative max-w-md space-y-9">
          {[
            { title: "Learn Your Way", text: "Access recorded courses and instructor-led live classes." },
            { title: "Practice & Prepare", text: "Strengthen your understanding with practice tests, study materials and assessments." },
            { title: "Track Your Progress", text: "Monitor your learning and pick up where you left off." },
          ].map(({ title, text }) => (
            <div key={title} className="space-y-2">
              <dt className="display text-[2.25rem] leading-tight tracking-[-0.03em] text-white">{title}</dt>
              <dd className="max-w-sm text-[15px] leading-relaxed text-white/65">{text}</dd>
            </div>
          ))}
        </dl>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Vipin Garg</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col items-center justify-center gap-8 p-6 sm:p-12 lg:bg-[radial-gradient(80%_60%_at_50%_0%,hsl(220_30%_97%),#fff)]">
        <Brand className="lg:hidden" white />
        <div className="w-full max-w-sm space-y-6 lg:animate-[rise_480ms_cubic-bezier(0.16,1,0.3,1)_both] lg:rounded-[22px] lg:bg-white lg:p-9 lg:shadow-[0_0_0_0.5px_rgba(16,42,67,0.06),0_2px_4px_rgba(16,42,67,0.03),0_24px_60px_-24px_rgba(16,42,67,0.22)]">{children}</div>
      </section>
    </main>
  )
}
