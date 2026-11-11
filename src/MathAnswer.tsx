import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {normalizeMathMarkdown} from './mathFormatting'
import './MathAnswer.css'

/** ReactMarkdown escapes raw HTML. KaTeX formats inline and block math.
 * Do not enable rehype-raw or trust untrusted Gemini output.
 */
export default function MathAnswer({answer}: {answer:string}) {
  return <div className="v2-math-answer" aria-label="Matematik tushuntirish">
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >{normalizeMathMarkdown(answer)}</ReactMarkdown>
  </div>
}
