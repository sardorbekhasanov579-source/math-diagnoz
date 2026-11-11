/** Normalize Gemini's common LaTeX delimiters for remark-math.
 * The returned string is untrusted Markdown, never raw HTML.
 */
export function normalizeMathMarkdown(input: string): string {
  let text = String(input ?? '').replace(/\r\n?/g, '\n').trim()
  // Convert common display delimiters \[ ... \] to remark-math blocks.
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `\n\n$$\n${formula.trim()}\n$$\n\n`)
  // Convert \( ... \) to inline $...$; the contents retain TeX backslashes.
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`)
  // Display math must be isolated, otherwise it gets treated as plain text.
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula: string) => `\n\n$$\n${formula.trim()}\n$$\n\n`)
  // Avoid excessively tall whitespace after normalizing math blocks.
  return text.replace(/\n{4,}/g, '\n\n\n').trim()
}
