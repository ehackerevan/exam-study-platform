import fs from 'node:fs';
export const themePath = new URL('../../renderer/ui-theme.css', import.meta.url);
export function applySharedUi(html, homeHref = 'index.html') {
  const css = fs.readFileSync(themePath, 'utf8').trim();
  if (/<\/style/i.test(css)) throw Error('Shared CSS must not close its style element');
  const style = `<style id="study-ui-theme">\n${css}\n</style>`;
  const existing = /<style id="study-ui-theme">[\s\S]*?<\/style>/;
  let result;
  if (existing.test(html)) result = html.replace(existing, () => style);
  else if (/<\/head>/i.test(html)) result = html.replace(/<\/head>/i, () => style + '\n</head>');
  else if (/<\/style>/i.test(html)) result = html.replace(/<\/style>/i, match => match + '\n' + style);
  else throw Error('HTML has no head or stylesheet to attach the shared UI');
  if (!/<link\b[^>]*\brel=["'](?:shortcut )?icon["']/i.test(result)) {
    result = result.replace(/<\/head>/i, '<link rel="icon" href="data:,">\n</head>');
  }
  for (const [id, file] of [['study-legal-terms','legal-terms.js'],['study-answer-search','answer-search.js']]) {
    const source = fs.readFileSync(new URL('../../renderer/'+file,import.meta.url),'utf8');
    const script = `<script id="${id}">\n${source}\n</script>`;
    const previousScript = new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`);
    if (previousScript.test(result)) result = result.replace(previousScript,()=>script);
    else result = result.replace(/<\/body>/i,()=>script+'\n</body>');
  }
  const previous = /<nav id="study-catalog-nav"[\s\S]*?<\/nav>/;
  if (homeHref === null) return result.replace(previous, '');
  if (!/^[\w./-]+\.html$/.test(homeHref)) throw Error('Invalid catalogue path');
  const nav = `<nav id="study-catalog-nav" aria-label="學科目錄"><a href="${homeHref}">← 學科目錄</a><span>教材與題庫</span></nav>`;
  return previous.test(result) ? result.replace(previous, () => nav) : result.replace(/<body\b[^>]*>/i, tag => tag + '\n' + nav);
}
