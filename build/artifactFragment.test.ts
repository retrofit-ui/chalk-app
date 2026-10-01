import { describe, it, expect } from 'vitest';
import { toArtifactFragment } from './artifactFragment';

const DOC = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,AAAA" />
    <title>chalk</title>
    <script type="module">console.log("app </div> string");</script>
    <style rel="stylesheet" crossorigin>body{color:red}</style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;

describe('toArtifactFragment', () => {
  const out = toArtifactFragment(DOC);

  it('drops the document skeleton and head-only metadata the artifact publish supplies itself', () => {
    for (const tag of ['<!DOCTYPE', '<html', '</html>', '<head>', '</head>', '<body>', '</body>', '<meta', '<link']) {
      expect(out).not.toContain(tag);
    }
  });

  it('orders title, stylesheet, page content, then the module script', () => {
    expect(out.trimStart().startsWith('<title>chalk</title>')).toBe(true);
    const style = out.indexOf('<style');
    const root = out.indexOf('<div id="root">');
    const script = out.indexOf('<script type="module">');
    expect(style).toBeGreaterThan(0);
    expect(root).toBeGreaterThan(style);
    expect(script).toBeGreaterThan(root);
  });

  it('keeps the script and stylesheet bodies intact', () => {
    expect(out).toContain('console.log("app </div> string");');
    expect(out).toContain('body{color:red}');
    expect(out).toContain('<noscript>You need to enable JavaScript to run this app.</noscript>');
  });

  it('refuses a document it cannot take apart', () => {
    expect(() => toArtifactFragment('<p>not a document</p>')).toThrow(/head/);
  });
});
