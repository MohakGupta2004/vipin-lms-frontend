import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/*
 * Renders author-written Markdown (GFM: tables, task lists, strikethrough, autolinks). Raw HTML is never rendered, so
 * it is safe for text instructors type. Single line breaks are kept, so plain-text descriptions written before
 * Markdown support still read the way they were typed.
 */

/** Drops react-markdown's `node` prop so it never reaches the DOM. */
function rest<T extends { node?: unknown }>({ node, ...p }: T) {
  void node
  return p
}

const components: Components = {
  h1: (p) => <h2 className="mt-6 mb-2 text-xl font-semibold text-heading first:mt-0" {...rest(p)} />,
  h2: (p) => <h3 className="mt-5 mb-2 text-lg font-semibold text-heading first:mt-0" {...rest(p)} />,
  h3: (p) => <h4 className="mt-4 mb-1.5 text-base font-semibold text-heading first:mt-0" {...rest(p)} />,
  h4: (p) => <h5 className="mt-4 mb-1 text-[15px] font-semibold text-heading first:mt-0" {...rest(p)} />,
  h5: (p) => <h6 className="mt-3 mb-1 text-sm font-semibold text-heading first:mt-0" {...rest(p)} />,
  h6: (p) => <h6 className="mt-3 mb-1 text-sm font-medium text-heading/70 first:mt-0" {...rest(p)} />,
  p: (p) => <p className="my-3 first:mt-0 last:mb-0" {...rest(p)} />,
  a: (p) => <a className="font-medium text-primary underline underline-offset-2 hover:opacity-75" target="_blank" rel="noopener noreferrer" {...rest(p)} />,
  ul: (p) => <ul className="my-3 list-disc space-y-1 pl-6 first:mt-0 last:mb-0 [&_ul]:my-1" {...rest(p)} />,
  ol: (p) => <ol className="my-3 list-decimal space-y-1 pl-6 first:mt-0 last:mb-0 [&_ol]:my-1" {...rest(p)} />,
  li: ({ className, ...p }) => <li className={cn("pl-1 marker:text-heading/40", className?.includes("task-list-item") && "list-none -ml-5")} {...rest(p)} />,
  blockquote: (p) => <blockquote className="my-3 border-l-[3px] border-primary/30 pl-4 text-heading/65 italic" {...rest(p)} />,
  hr: () => <hr className="my-5 border-black/10" />,
  strong: (p) => <strong className="font-semibold text-heading" {...rest(p)} />,
  code: ({ className, ...p }) =>
    className?.startsWith("language-") ? (
      <code className={className} {...rest(p)} />
    ) : (
      <code className="rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[0.9em]" {...rest(p)} />
    ),
  pre: (p) => <pre className="my-3 overflow-x-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[13px] leading-relaxed" {...rest(p)} />,
  table: (p) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...rest(p)} />
    </div>
  ),
  th: (p) => <th className="border border-black/10 bg-black/[0.03] px-3 py-1.5 text-left font-semibold text-heading" {...rest(p)} />,
  td: (p) => <td className="border border-black/10 px-3 py-1.5 align-top" {...rest(p)} />,
  img: ({ alt, ...p }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ""} className="my-3 max-w-full rounded-lg" {...rest(p)} />
  ),
  input: (p) => <input {...rest(p)} disabled className="mr-1.5 align-middle" />,
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[15px] leading-relaxed text-gray-700 [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
