type Block =
  | { kind: "text"; lines: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }

const SEPARATOR_RE = /^\|(\s*:?-{3,}:?\s*\|)+$/

/** "| a | b \| c |" → ["a", "b | c"]. A pipe written as \| stays inside its cell. */
function splitRow(line: string) {
  const cells: string[] = []
  let cell = ""
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") {
      cell += "|"
      i++
    } else if (body[i] === "|") {
      cells.push(cell.trim())
      cell = ""
    } else {
      cell += body[i]
    }
  }
  cells.push(cell.trim())
  return cells
}

/** A table is a "| header |" line, a "| --- |" line, then more "| row |" lines. */
function splitBlocks(text: string): Block[] {
  const lines = text.split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const next = (lines[i + 1] ?? "").trim()
    if (line.startsWith("|") && SEPARATOR_RE.test(next)) {
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ kind: "table", header, rows })
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last && last.kind === "text") {
      last.lines.push(lines[i])
    } else {
      blocks.push({ kind: "text", lines: [lines[i]] })
    }
    i++
  }
  return blocks
}

/** Question text with any Markdown table drawn as a real table; every other line stays plain text. */
export function QuestionBlocks({ text }: { text: string }) {
  const blocks = splitBlocks(text)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "text") {
          const content = block.lines.join("\n").trim()
          if (!content) return null
          return (
            <p key={i} className="whitespace-pre-line">
              {content}
            </p>
          )
        }
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9em]">
              <thead>
                <tr>
                  {block.header.map((cell, c) => (
                    <th
                      key={c}
                      className="border border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-heading"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className="border border-gray-200 px-3 py-2 text-gray-700"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
