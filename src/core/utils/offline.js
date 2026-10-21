// Inspect resource references, not CDN names that may occur in teaching text.
export function findExternalResources(html) {
  const urls = new Set();
  const document = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
  for (const tag of document.matchAll(/<(script|link|img|iframe|source|audio|video|embed|object)\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries([...tag[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
    const value = attributes[tag[1].toLowerCase() === 'link' ? 'href' : tag[1].toLowerCase() === 'object' ? 'data' : 'src'];
    if (value && /^(?:https?:)?\/\//i.test(value.trim())) urls.add(value.trim());
  }
  for (const style of document.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const match of style[1].matchAll(/(?:url\(\s*["']?|@import\s*["'])(https?:\/\/[^\s"')]+|\/\/[^\s"')]+)/gi)) urls.add(match[1]);
  }
  return [...urls];
}
