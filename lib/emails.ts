// Outlook only splits pasted recipients on ";" by default. Gmail accepts ";" too,
// so "; " works for both.
const PASTE_SEPARATOR = "; "

export function joinEmailsForPaste(emails: string[]) {
  return emails.join(PASTE_SEPARATOR)
}
