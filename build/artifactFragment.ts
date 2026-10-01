// Turns the single-file build (a complete HTML document) into the form the Claude artifact
// publish expects: page content only, which the publish wraps in its own doctype/head/body
// skeleton (charset, viewport meta and a small reset). Title and stylesheet go first so the
// title is found in the first 8 KB; the module script goes last so #root exists when it runs.

function cut(html: string, open: RegExp, close: string, what: string): { inner: string; rest: string } {
  const start = html.match(open);
  if (!start || start.index === undefined) throw new Error(`artifact fragment: no <${what}> in the built document`);
  const from = start.index + start[0].length;
  // Last occurrence: a script body could contain the closing tag of an *earlier* element,
  // but the real closer of the outermost element is always the final one.
  const to = html.lastIndexOf(close);
  if (to < from) throw new Error(`artifact fragment: no </${what}> in the built document`);
  return { inner: html.slice(from, to), rest: html.slice(0, start.index) + html.slice(to + close.length) };
}

function take(html: string, open: RegExp, close: string, what: string): string {
  const start = html.match(open);
  if (!start || start.index === undefined) throw new Error(`artifact fragment: no <${what}> in the built document`);
  const end = html.indexOf(close, start.index);
  if (end < 0) throw new Error(`artifact fragment: no </${what}> in the built document`);
  return html.slice(start.index, end + close.length);
}

export function toArtifactFragment(html: string): string {
  const head = cut(html, /<head[^>]*>/i, '</head>', 'head').inner;
  const body = cut(html, /<body[^>]*>/i, '</body>', 'body').inner;

  const title = take(head, /<title[^>]*>/i, '</title>', 'title');
  const style = take(head, /<style[^>]*>/i, '</style>', 'style');
  const script = take(head, /<script[^>]*>/i, '</script>', 'script');

  return [title, style, body.trim(), script].join('\n') + '\n';
}
