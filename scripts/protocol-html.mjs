// Render the complete release as readable HTML without executing Markdown HTML.
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function protocolHtml(markdown, revision) {
  const content = markdown.split(/```(?:json)?\n/).map((part, index) => {
    if (index % 2) return `<pre><code>${escape(part)}</code></pre>`
    return part.trim().split(/\n\n+/).filter(Boolean).map(block => {
      const heading = /^(#{1,6}) (.+)$/.exec(block)
      return heading ? `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>` : `<p>${escape(block)}</p>`
    }).join('\n')
  }).join('\n')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tin to Cellar protocol ${revision}</title>
<style>body{max-width:76rem;margin:2rem auto;padding:0 1rem;font:1rem/1.6 system-ui;color:#242820;background:#faf9f5}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{padding:1rem;background:#eeede7}h1,h2{line-height:1.2}</style></head>
<body><main>${content}</main></body></html>\n`
}
