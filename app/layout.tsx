import type { Metadata } from "next"
import { Arimo } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

// One family for everything: UI text, titles and key figures.
const sans = Arimo({ subsets: ["latin"], variable: "--font-ui" })

export const metadata: Metadata = {
  title: { default: "Vipin Garg — Finance Coach", template: "%s · Vipin Garg" },
  description: "Courses, notes and tests from finance coach Vipin Garg.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", sans.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
