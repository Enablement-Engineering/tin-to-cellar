// Render the complete release as readable HTML without executing Markdown HTML.
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function protocolHtml(markdown, revision) {
  const prose = (part) => part.trim().split(/\n\n+/).filter(Boolean).map(block => {
      const heading = /^(#{1,6}) (.+)$/.exec(block)
      return heading ? `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>` : `<p>${escape(block)}</p>`
    }).join('\n')
  const sections = []
  let offset = 0
  for (const match of markdown.matchAll(/```(json|python)\n([\s\S]*?)\n```/g)) {
    sections.push(prose(markdown.slice(offset, match.index)))
    sections.push(`<pre><code class="language-${match[1]}">${escape(match[2])}</code></pre>`)
    offset = match.index + match[0].length
  }
  sections.push(prose(markdown.slice(offset)))
  const content = sections.join('\n')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tin to Cellar protocol ${revision}</title>
<style>body{max-width:76rem;margin:2rem auto;padding:0 1rem;font:1rem/1.6 system-ui;color:#242820;background:#faf9f5}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{padding:1rem;background:#eeede7}h1,h2{line-height:1.2}</style></head>
<body><main>${content}</main></body></html>\n`
}
