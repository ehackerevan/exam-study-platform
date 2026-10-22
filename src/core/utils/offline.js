// Inspect resource references, not CDN names that may occur in teaching text.
// shortcut: scans static HTML/CSS references; use browser request capture for runtime-created URLs.
function addCssResources(urls, css) {
  for (const match of css.matchAll(/(?:url\(\s*["']?|@import\s*["'])(https?:\/\/[^\s"')]+|\/\/[^\s"')]+)/gi)) urls.add(match[1]);
}

function addSrcsetResources(urls, srcset) {
  for (const candidate of srcset.split(',')) {
    const url = candidate.trim().split(/\s+/, 1)[0];
    if (/^(?:https?:)?\/\//i.test(url)) urls.add(url);
  }
}

export function findExternalResources(html) {
  const urls = new Set();
  const document = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
  const resourceAttributes = {
    script: ['src'], link: ['href', 'imagesrcset'], img: ['src', 'srcset'], input: ['src'], iframe: ['src'],
    source: ['src', 'srcset'], audio: ['src'], video: ['src', 'poster'], embed: ['src'], object: ['data'],
    track: ['src'], image: ['href', 'xlink:href'], use: ['href', 'xlink:href']
  };
  for (const tag of document.matchAll(/<(script|link|img|input|iframe|source|audio|video|embed|object|track|image|use)\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries([...tag[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
    for (const attribute of resourceAttributes[tag[1].toLowerCase()]) {
      const value = attributes[attribute];
      if (!value) continue;
      if (attribute.endsWith('srcset')) addSrcsetResources(urls, value);
      else if (/^(?:https?:)?\/\//i.test(value.trim())) urls.add(value.trim());
    }
    if (attributes.style) addCssResources(urls, attributes.style);
  }
  for (const style of document.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    addCssResources(urls, style[1]);
  }
  return [...urls];
}
