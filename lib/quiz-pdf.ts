/**
 * Turns a question-paper PDF and its answer-key PDF into quiz create bodies, entirely in the browser.
 *
 * The parser is strict: anything it can't place is reported as a FormatIssue rather than guessed at.
 * See QUESTIONS_SAMPLE / ANSWERS_SAMPLE for the expected layout.
 *
 * Kept free of app imports so it can be exercised directly with Node.
 */

export type PdfFile = "questions" | "answers"

/**
 * One line of text, in reading order, with the page it came from.
 * `cells` are the pieces of the line that sit in separate columns (only when there are 2 or more).
 * `table` is a run of such lines already written as a Markdown table.
 */
export type PdfLine = {
  text: string
  page: number
  cells?: string[]
  table?: string
}

/** A line as read from one PDF page, before cleaning. */
export type RawLine = { text: string; cells: string[] }

export type FormatIssue = {
  file: PdfFile | "both"
  page?: number
  message: string
}

export type ImportedQuestion = {
  questionText: string
  explanation: string
  options: { optionText: string; isCorrect: boolean }[]
}

/** A set from the PDFs. `numbers[i]` is the printed number of `questions[i]`. */
export type ImportedSet = {
  number: number
  numbers: number[]
  questions: ImportedQuestion[]
}

/** A slice of a set small enough for one create request. */
export type QuizPart = {
  set: number
  part: number
  parts: number
  first: number
  last: number
  questions: ImportedQuestion[]
}

export type ImportResult =
  { ok: true; sets: ImportedSet[] } | { ok: false; issues: FormatIssue[] }

export const QUESTIONS_SAMPLE = `Set 1
25 Questions
1. Which combination of statements is MOST accurate?
I. First statement.
II. Second statement.
A. I only
B. II only
C. I and II
D. Neither
2. Next question…`

export const ANSWERS_SAMPLE = `Set 1 Answer Key
1. C 2. A 3. B …
Explanations
1. C - Why C is correct.
Concept tested: Topic name
2. A - Why A is correct.
Concept tested: Topic name`

// Server limits (vipin-lms-backend internal/service/quizzes.go, internal/handlers/quizzes.go).
export const MAX_QUESTIONS_PER_QUIZ = 200
const MAX_QUESTION = 2000
const MAX_OPTION = 1000
const MAX_EXPLANATION = 5000
const MIN_OPTIONS = 2
const MAX_OPTIONS = 10
/** The server reads at most 4 MB per quiz body; leave room for the title and the rest. */
const MAX_PART_BYTES = 3.5 * 1024 * 1024

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
/** One answer letter, or several joined by ", ", " & ", "/" or " and " (rejected: one correct answer only). */
const ANSWER = String.raw`[A-Z](?:\s*(?:,|&|\/|\band\b)\s*[A-Z])*|[A-Z]+`
const SET_RE = /^Set\s+(\d+)$/i
const COUNT_RE = /^(\d+)\s+Questions?$/i
const QUESTION_RE = /^(\d+)\.\s+(.+)$/
const OPTION_RE = /^([A-Z])\.\s+(.+)$/
const LABEL_ONLY_RE = /^(?:\d+|[A-Z]|[IVX]+)\.$/
const ROMAN_RE = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/
const KEY_SET_RE = /^Set\s+(\d+)\s+Answer\s+Key$/i
const KEY_ENTRY_RE = new RegExp(String.raw`(\d+)\.\s*(${ANSWER})\b`, "g")
const EXPLANATIONS_RE = /^Explanations$/i
const EXPLANATION_RE = new RegExp(
  String.raw`^(\d+)\.\s+(${ANSWER})\s*[-–—]\s*(.*)$`
)
const CONCEPT_RE = /^Concept tested:\s*(.*)$/i
const PAGE_NUMBER_RE = /^(?:Page\s+)?\d+(?:\s+of\s+\d+)?$/i

const clip = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

/** Joins a wrapped line, closing up words hyphenated across the break ("bi-" + "weekly"). */
const join = (a: string, b: string) =>
  a === "" ? b : /[A-Za-z]-$/.test(a) ? a + b : `${a} ${b}`

/** "A, C" → ["A", "C"]; "AC" → ["A", "C"]. */
const lettersOf = (answer: string) =>
  answer
    .replace(/\band\b/g, "")
    .replace(/[^A-Z]/g, "")
    .split("")

/** "3, 4, 5, 9" → "3–5, 9", capped so a long list stays readable. */
function ranges(ns: number[], max = 8) {
  const out: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    out.push(i === j ? `${ns[i]}` : `${ns[i]}–${ns[j]}`)
    i = j
  }
  return out.length > max
    ? `${out.slice(0, max).join(", ")} and ${out.length - max} more`
    : out.join(", ")
}

/**
 * Normalises raw per-page lines: collapses whitespace, drops blank lines, bare page numbers,
 * and the running header (the first line, when every page starts with the same one).
 */
export function cleanLines(pages: RawLine[][]): PdfLine[] {
  const norm = pages.map((lines) => {
    const cleaned: { text: string; cells: string[] }[] = []
    for (const line of lines) {
      const text = cleanText(line.text)
      if (!text) continue
      const cells = line.cells.map(cleanText).filter(Boolean)
      cleaned.push({ text, cells })
    }
    return cleaned
  })
  const firsts = norm.map((p) => p[0]?.text).filter(Boolean)
  const header =
    norm.length > 1 &&
    firsts.length === norm.length &&
    firsts.every((f) => f === firsts[0])
      ? firsts[0]
      : null
  const out: PdfLine[] = []
  norm.forEach((lines, i) => {
    for (const { text, cells } of lines) {
      if (text === header || PAGE_NUMBER_RE.test(text)) continue
      const line: PdfLine = { text, page: i + 1 }
      if (cells.length >= 2) line.cells = cells
      out.push(line)
    }
  })
  return out
}

const cleanText = (s: string) => s.replace(/[\s\u00a0]+/g, " ").trim()

/** Two cells this far apart (in PDF points) are in different table columns. */
const COLUMN_GAP = 12

/** Cells go between pipes, so a pipe inside a cell is escaped. */
const markdownRow = (cells: string[]) =>
  "| " + cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ") + " |"

/**
 * Finds tables: two or more lines in a row that are split into the same number of columns.
 * Each table becomes one line whose `table` is Markdown; its `text` stays the plain words,
 * so a table found outside a question's stem is read as ordinary text.
 */
export function groupTables(lines: PdfLine[]): PdfLine[] {
  const out: PdfLine[] = []
  let i = 0
  while (i < lines.length) {
    const first = lines[i]
    if (!isTableRow(first)) {
      out.push(first)
      i++
      continue
    }
    let end = i + 1
    while (
      end < lines.length &&
      isTableRow(lines[end]) &&
      lines[end].page === first.page &&
      lines[end].cells!.length === first.cells!.length
    ) {
      end++
    }
    const run = lines.slice(i, end)
    if (run.length < 2) {
      out.push(first)
      i++
      continue
    }
    const markdown: string[] = []
    for (let r = 0; r < run.length; r++) {
      markdown.push(markdownRow(run[r].cells!))
      if (r === 0) markdown.push("|" + " --- |".repeat(first.cells!.length))
    }
    out.push({
      text: run.map((l) => l.text).join(" "),
      page: first.page,
      table: markdown.join("\n"),
    })
    i = end
  }
  return out
}

/** Side-by-side options ("A. Yes   B. No") are in columns too, but they are not a table. */
function isTableRow(line: PdfLine) {
  if (!line.cells) return false
  for (const cell of line.cells) {
    if (OPTION_RE.test(cell) || ROMAN_RE.test(cell)) return false
    // "1." or "A." alone is the label of a hanging-indent question or option, not a table cell.
    if (LABEL_ONLY_RE.test(cell)) return false
  }
  return true
}

type QDraft = {
  number: number
  page: number
  text: string
  options: { letter: string; text: string }[]
}
type QSet = {
  number: number
  page: number
  declared: number | null
  /** Last question number of the previous set, so numbering may run on across sets. */
  prevEnd: number
  questions: QDraft[]
}

export function parseQuestions(pdfLines: PdfLine[]): {
  sets: QSet[]
  issues: FormatIssue[]
} {
  const lines = groupTables(pdfLines)
  const issues: FormatIssue[] = []
  const issue = (page: number, message: string) =>
    issues.push({ file: "questions", page, message })
  const sets: QSet[] = []
  let set: QSet | null = null
  let q: QDraft | null = null
  let strayQuestion = false

  for (const { text, page, table } of lines) {
    const s = SET_RE.exec(text)
    if (s) {
      const prevEnd: number = set?.questions.at(-1)?.number ?? 0
      set = {
        number: Number(s[1]),
        page,
        declared: null,
        prevEnd,
        questions: [],
      }
      sets.push(set)
      q = null
      continue
    }
    if (!set) {
      // Title and intro text before the first set heading are ignored, but questions there are a mistake.
      if (QUESTION_RE.test(text) && !strayQuestion) {
        strayQuestion = true
        issue(
          page,
          `Question "${clip(text)}" appears before any "Set 1" heading.`
        )
      }
      continue
    }
    const where = `Set ${set.number}`
    const c = COUNT_RE.exec(text)
    if (c && !q && set.declared === null) {
      set.declared = Number(c[1])
      continue
    }

    const inStem = !!q && q.options.length === 0
    if (inStem && table) {
      // Checked before the question number, because a table's first column may be numbered.
      q!.text += `\n${table}`
      continue
    }
    const qm = QUESTION_RE.exec(text)
    const last = set.questions.at(-1)
    const expected = last ? last.number + 1 : null
    // Inside a question's stem only the expected next number starts a new question; anything else is wrapped text.
    if (qm && (!inStem || Number(qm[1]) === expected)) {
      const n = Number(qm[1])
      if (expected === null) {
        if (n !== 1 && n !== set.prevEnd + 1)
          issue(
            page,
            `${where} starts at question ${n}; start it at 1${set.prevEnd ? ` or ${set.prevEnd + 1} (continuing the previous set)` : ""}.`
          )
      } else if (n !== expected) {
        issue(
          page,
          `${where}: expected question ${expected} after question ${expected - 1} but found question ${n}.`
        )
      }
      q = { number: n, page, text: qm[2], options: [] }
      set.questions.push(q)
      continue
    }
    if (!q) {
      issue(
        page,
        `${where}: unexpected text before the first question: "${clip(text)}".`
      )
      continue
    }
    const om = OPTION_RE.exec(text)
    if (om && om[1] === LETTERS[q.options.length]) {
      q.options.push({ letter: om[1], text: om[2] })
    } else if (inStem && ROMAN_RE.test(text)) {
      q.text += `\n${text}` // "I. …", "II. …" statements keep their own lines
    } else if (om && q.options.length > 0) {
      issue(
        page,
        `${where} Q${q.number}: option ${om[1]} is out of order (expected ${LETTERS[q.options.length]}).`
      )
    } else if (inStem) {
      const lastLine = q.text.slice(q.text.lastIndexOf("\n") + 1)
      // Text after a table must not be glued onto the table's last row.
      q.text = lastLine.startsWith("|") ? `${q.text}\n${text}` : join(q.text, text)
    } else {
      const lastOption = q.options[q.options.length - 1]
      lastOption.text = join(lastOption.text, text)
    }
  }

  if (sets.length === 0) {
    issues.push({
      file: "questions",
      message:
        'No "Set 1" heading found. Each set must start with a line like "Set 1".',
    })
  }
  const seen = new Set<number>()
  for (const st of sets) {
    const where = `Set ${st.number}`
    if (seen.has(st.number)) issue(st.page, `${where} appears more than once.`)
    seen.add(st.number)
    if (st.questions.length === 0)
      issue(
        st.page,
        `${where} has no questions. Questions must start with "1. ", "2. " …`
      )
    if (st.declared !== null && st.declared !== st.questions.length) {
      issue(
        st.page,
        `${where} says ${st.declared} questions but ${st.questions.length} were found.`
      )
    }
    for (const x of st.questions) {
      const at = `${where} Q${x.number}`
      if (x.options.length < MIN_OPTIONS)
        issue(
          x.page,
          `${at} has ${x.options.length} option(s); at least ${MIN_OPTIONS} lettered options ("A. ", "B. " …) are needed.`
        )
      if (x.options.length > MAX_OPTIONS)
        issue(
          x.page,
          `${at} has ${x.options.length} options; at most ${MAX_OPTIONS} (A–J) are allowed.`
        )
      if (x.text.length > MAX_QUESTION)
        issue(
          x.page,
          `${at} is ${x.text.length} characters; the limit is ${MAX_QUESTION}.`
        )
      for (const o of x.options)
        if (o.text.length > MAX_OPTION)
          issue(
            x.page,
            `${at} option ${o.letter} is ${o.text.length} characters; the limit is ${MAX_OPTION}.`
          )
    }
  }
  return { sets, issues }
}

type KEntry = {
  number: number
  letter: string
  page: number
  text: string
  concept: string | null
}
type KSet = {
  number: number
  page: number
  /** Raw answer-key text, read as one stream so a grid of answers may wrap or run in columns. */
  raw: string
  key: Map<number, string>
  entries: Map<number, KEntry>
  sawExplanations: boolean
}

export function parseAnswers(lines: PdfLine[]): {
  sets: KSet[]
  issues: FormatIssue[]
} {
  const issues: FormatIssue[] = []
  const issue = (page: number, message: string) =>
    issues.push({ file: "answers", page, message })
  const sets: KSet[] = []
  let set: KSet | null = null
  let e: KEntry | null = null

  for (const { text, page } of lines) {
    const s = KEY_SET_RE.exec(text)
    if (s) {
      set = {
        number: Number(s[1]),
        page,
        raw: "",
        key: new Map(),
        entries: new Map(),
        sawExplanations: false,
      }
      sets.push(set)
      e = null
      continue
    }
    if (!set) continue // title and intro text
    const where = `Set ${set.number}`
    if (!set.sawExplanations) {
      if (EXPLANATIONS_RE.test(text)) set.sawExplanations = true
      else set.raw += ` ${text}`
      continue
    }
    const em = EXPLANATION_RE.exec(text)
    // "<n>. <letter> - " starts a new explanation when n moves forward, so one missing explanation
    // is reported on its own instead of swallowing the rest as wrapped text.
    if (em && (!e || Number(em[1]) > e.number)) {
      const n = Number(em[1])
      const letters = lettersOf(em[2])
      if (letters.length > 1)
        issue(
          page,
          `${where} Q${n}: explanation gives ${letters.length} answers (${letters.join(", ")}); each question needs exactly one.`
        )
      if (set.entries.has(n))
        issue(page, `${where} Q${n}: explanation appears more than once.`)
      e = { number: n, letter: letters[0], page, text: em[3], concept: null }
      set.entries.set(n, e)
      continue
    }
    if (!e) {
      issue(
        page,
        `${where} explanations: expected "<number>. <letter> - <explanation>" but found "${clip(text)}".`
      )
      continue
    }
    const cm = CONCEPT_RE.exec(text)
    if (cm) e.concept = cm[1]
    else if (e.concept !== null) e.concept = join(e.concept, text)
    else e.text = join(e.text, text)
  }

  if (sets.length === 0) {
    issues.push({
      file: "answers",
      message:
        'No "Set 1 Answer Key" heading found. Each set must start with a line like "Set 1 Answer Key".',
    })
  }
  const seen = new Set<number>()
  for (const st of sets) {
    const where = `Set ${st.number}`
    if (seen.has(st.number))
      issue(st.page, `${where} answer key appears more than once.`)
    seen.add(st.number)

    const multi: string[] = []
    const dupes: number[] = []
    for (const m of st.raw.matchAll(KEY_ENTRY_RE)) {
      const n = Number(m[1])
      const letters = lettersOf(m[2])
      if (letters.length > 1) multi.push(`Q${n} (${letters.join(", ")})`)
      if (st.key.has(n)) dupes.push(n)
      st.key.set(n, letters[0])
    }
    const leftover = st.raw
      .replace(KEY_ENTRY_RE, " ")
      .replace(/[,;|]/g, " ")
      .trim()
    if (leftover)
      issue(
        st.page,
        `${where} answer key: couldn't read "${clip(leftover)}". Answers must look like "1. A 2. C …".`
      )
    if (multi.length)
      issue(
        st.page,
        `${where} answer key gives more than one answer for ${multi.slice(0, 6).join(", ")}${multi.length > 6 ? ` and ${multi.length - 6} more` : ""}. Each question needs exactly one correct answer.`
      )
    if (dupes.length)
      issue(
        st.page,
        `${where} answer key lists question ${ranges(dupes)} more than once.`
      )
    if (st.key.size === 0) {
      issue(
        st.page,
        `${where} answer key is empty. List answers like "1. A 2. C …".`
      )
      continue
    }

    const numbers = [...st.key.keys()].sort((a, b) => a - b)
    const gaps: number[] = []
    for (let n = numbers[0]; n <= numbers[numbers.length - 1]; n++)
      if (!st.key.has(n)) gaps.push(n)
    if (gaps.length)
      issue(st.page, `${where} answer key is missing question ${ranges(gaps)}.`)

    if (!st.sawExplanations) {
      issue(
        st.page,
        `${where} has no "Explanations" heading after its answer key.`
      )
      continue
    }
    const unexplained = numbers.filter((n) => !st.entries.has(n))
    if (unexplained.length)
      issue(
        st.page,
        `${where} has no explanation for question ${ranges(unexplained)}.`
      )
    for (const x of st.entries.values()) {
      const k = st.key.get(x.number)
      if (k === undefined)
        issue(
          x.page,
          `${where} Q${x.number}: explanation for a question that isn't in the answer key.`
        )
      else if (k !== x.letter)
        issue(
          x.page,
          `${where} Q${x.number}: answer key says ${k} but the explanation says ${x.letter}.`
        )
      if (!x.text) issue(x.page, `${where} Q${x.number}: explanation is empty.`)
    }
  }
  return { sets, issues }
}

const explanationOf = (e: KEntry | undefined) =>
  e ? (e.concept ? `${e.text}\n\nConcept tested: ${e.concept}` : e.text) : ""

/** Matches the two parsed documents set by set and question by question (by printed number). */
export function combine(
  questionLines: PdfLine[],
  answerLines: PdfLine[]
): ImportResult {
  if (
    questionLines.some((l) => KEY_SET_RE.test(l.text)) &&
    answerLines.some((l) => SET_RE.test(l.text))
  ) {
    return {
      ok: false,
      issues: [
        {
          file: "both",
          message:
            "The files look swapped: the answer key was uploaded as the question paper and vice versa.",
        },
      ],
    }
  }
  const qs = parseQuestions(questionLines)
  const ks = parseAnswers(answerLines)
  const issues = [...qs.issues, ...ks.issues]
  if (issues.length) return { ok: false, issues }

  const out: ImportedSet[] = []
  for (const st of qs.sets) {
    const where = `Set ${st.number}`
    const key = ks.sets.find((k) => k.number === st.number)
    if (!key) {
      issues.push({
        file: "answers",
        message: `${where} is in the question paper but has no "${where} Answer Key".`,
      })
      continue
    }
    const numbers = st.questions.map((x) => x.number)
    const asked = new Set(numbers)
    const unanswered = numbers.filter((n) => !key.key.has(n))
    const extra = [...key.key.keys()]
      .filter((n) => !asked.has(n))
      .sort((a, b) => a - b)
    if (unanswered.length)
      issues.push({
        file: "both",
        message: `${where}: question ${ranges(unanswered)} has no answer in the answer key.`,
      })
    if (extra.length)
      issues.push({
        file: "both",
        message: `${where}: the answer key has answers for question ${ranges(extra)}, which isn't in the question paper.`,
      })
    if (unanswered.length || extra.length) continue

    const questions = st.questions.map((x) => {
      const letter = key.key.get(x.number)!
      const correct = x.options.findIndex((o) => o.letter === letter)
      if (correct < 0)
        issues.push({
          file: "both",
          page: x.page,
          message: `${where} Q${x.number}: answer ${letter} isn't one of its options (A–${x.options.at(-1)?.letter}).`,
        })
      const entry = key.entries.get(x.number)
      const explanation = explanationOf(entry)
      if (explanation.length > MAX_EXPLANATION)
        issues.push({
          file: "answers",
          page: entry?.page,
          message: `${where} Q${x.number}: explanation is ${explanation.length} characters; the limit is ${MAX_EXPLANATION}.`,
        })
      return {
        questionText: x.text,
        explanation,
        options: x.options.map((o, j) => ({
          optionText: o.text,
          isCorrect: j === correct,
        })),
      }
    })
    out.push({ number: st.number, numbers, questions })
  }
  for (const k of ks.sets) {
    if (!qs.sets.some((s) => s.number === k.number)) {
      issues.push({
        file: "questions",
        message: `Set ${k.number} has an answer key but isn't in the question paper.`,
      })
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, sets: out }
}

const encoder = new TextEncoder()

/**
 * Splits a set into as few quizzes as the server allows: at most MAX_QUESTIONS_PER_QUIZ questions
 * and MAX_PART_BYTES of JSON each. Most sets come back as a single part.
 */
export function splitSet(set: ImportedSet): QuizPart[] {
  const chunks: [number, number][] = []
  let start = 0
  let bytes = 0
  set.questions.forEach((q, i) => {
    const size = encoder.encode(JSON.stringify(q)).length + 1
    if (
      i > start &&
      (i - start >= MAX_QUESTIONS_PER_QUIZ || bytes + size > MAX_PART_BYTES)
    ) {
      chunks.push([start, i])
      start = i
      bytes = 0
    }
    bytes += size
  })
  chunks.push([start, set.questions.length])
  return chunks.map(([from, to], i) => ({
    set: set.number,
    part: i + 1,
    parts: chunks.length,
    first: set.numbers[from],
    last: set.numbers[to - 1],
    questions: set.questions.slice(from, to),
  }))
}

/**
 * Reads a PDF's text as lines. Throws a readable Error when the file can't be read.
 * `onPage` reports progress, since a long paper can take a few seconds.
 */
export async function readPdfLines(
  file: File,
  onPage?: (done: number, total: number) => void
): Promise<PdfLine[]> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  )
    throw new Error(`"${file.name}" is not a PDF.`)
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString()
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  })
  let doc
  try {
    doc = await task.promise
  } catch {
    void task.destroy()
    throw new Error(
      `"${file.name}" could not be opened. It may be damaged or password-protected.`
    )
  }
  try {
    const pages: RawLine[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const { items } = await page.getTextContent()
      page.cleanup()
      const lines: RawLine[] = []
      let cur = ""
      let cells: string[] = []
      let cell = ""
      let lastY: number | null = null
      let lastEnd = 0
      const endLine = () => {
        cells.push(cell)
        lines.push({ text: cur, cells })
        cur = ""
        cells = []
        cell = ""
      }
      for (const it of items) {
        if (!("str" in it)) continue
        const y = it.transform[5]
        const x = it.transform[4]
        // Break on an explicit end of line, or when the baseline moves to a new line.
        if (
          it.str.trim() &&
          lastY !== null &&
          Math.abs(y - lastY) > 2 &&
          cur.trim()
        ) {
          endLine()
        }
        // A wide gap on the same line means the next text is in another column.
        if (it.str.trim() && cell.trim() && x - lastEnd > COLUMN_GAP) {
          cells.push(cell)
          cell = ""
        }
        cur += it.str
        cell += it.str
        if (it.str.trim()) {
          lastY = y
          lastEnd = x + it.width
        }
        if (it.hasEOL) endLine()
      }
      if (cur) endLine()
      pages.push(lines)
      onPage?.(p, doc.numPages)
    }
    const lines = cleanLines(pages)
    if (lines.length === 0)
      throw new Error(
        `"${file.name}" has no selectable text. Scanned or image-only PDFs can't be read.`
      )
    return lines
  } finally {
    void task.destroy()
  }
}
