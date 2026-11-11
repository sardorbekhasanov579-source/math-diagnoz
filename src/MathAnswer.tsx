import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {normalizeMathMarkdown} from './mathFormatting'
import './MathAnswer.css'

/** ReactMarkdown escapes raw HTML. KaTeX formats inline and block math.
 * Do not enable rehype-raw or trust untrusted Gemini output.
 */
/** Common safe Markdown + KaTeX renderer used by every AI module.
 * `compact` is appropriate inside a label, button or option.
 * HTML in model output is never executed. KaTeX uses trust=false.
 */
export default function MathAnswer({answer,compact=false}: {answer:string;compact?:boolean}) {
  const normalized = normalizeMathMarkdown(answer)
  // Inside buttons and labels only inline math is valid HTML.
  const display = compact ? normalized.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_all, formula:string) => `$${formula.trim()}$`) : normalized
  const content = <ReactMarkdown
    skipHtml
    remarkPlugins={[remarkMath]}
    rehypePlugins={[[rehypeKatex, {trust:false, strict:'warn', throwOnError:false}]]}
    components={compact ? {p: ({children}) => <span>{children}</span>} : undefined}
  >{display}</ReactMarkdown>
  if (compact) return <span className="v2-math-answer v2-math-inline">{content}</span>
  return <div className="v2-math-answer" aria-label="Matematik tushuntirish">{content}</div>
}
