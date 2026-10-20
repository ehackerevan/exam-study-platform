(function () {
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function diagram(source) {
    const labels = new Map();
    const node = /\b([A-Za-z][\w-]*)\s*(?:\["([^"]+)"\]|\[([^\]]+)\]|\("([^"]+)"\)|\(([^)]+)\)|\{"([^"]+)"\}|\{([^}]+)\})/g;
    for (const match of source.matchAll(node)) labels.set(match[1], match.slice(2).find(value => value !== undefined).replace(/<br\s*\/?>/gi, ' '));
    const rows = [];
    for (const line of source.split('\n')) {
      const pie = line.match(/^\s*"([^"]+)"\s*:\s*([\d.]+)/);
      if (pie) rows.push(`<tr><td>${escape(pie[1])}</td><td>${escape(pie[2])}</td></tr>`);
      const edge = line.replace(node, (_, id) => id).match(/^\s*([A-Za-z][\w-]*)\s*(?:-->|---|-.->|==>)\s*(?:\|([^|]+)\|)?\s*([A-Za-z][\w-]*)/);
      if (edge) rows.push(`<tr><td>${escape(labels.get(edge[1]) || edge[1])}</td><td>${edge[2] ? `<strong>${edge[2].split(/<br\s*\/?>/i).map(escape).join('<br>')}</strong><br>` : ''}${escape(labels.get(edge[3]) || edge[3])}</td></tr>`);
    }
    // shortcut: current course diagrams use simple edges; retain unfamiliar syntax as a text alternative.
    return rows.length ? `<div class="table-scroll" tabindex="0" aria-label="關係圖文字對照"><table><caption>概念關係對照</caption><tbody>${rows.join('')}</tbody></table></div>` : `<details><summary>概念圖文字版</summary><pre>${escape(source)}</pre></details>`;
  }
  function render(raw) {
    const source = String(raw || '').replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, body) => '\n\n' + diagram(body) + '\n\n');
    const template = document.createElement('template');
    template.innerHTML = window.marked.parse(source, {gfm:true, breaks:true});
    const allowed = new Set('P BR STRONG EM DEL S UL OL LI BLOCKQUOTE PRE CODE H1 H2 H3 H4 H5 H6 HR TABLE CAPTION THEAD TBODY TR TH TD A IMG DIV DETAILS SUMMARY SPAN SUP SUB'.split(' '));
    for (const element of [...template.content.querySelectorAll('*')]) {
      if (!allowed.has(element.tagName)) { element.remove(); continue; }
      for (const attr of [...element.attributes]) {
        if (element.tagName === 'A' && attr.name === 'href') {
          if (!/^(https?:\/\/|#|[^:/?#]+\.md(?:#.*)?$)/i.test(attr.value.trim())) element.removeAttribute('href');
        } else if (element.tagName === 'IMG' && ['src','alt'].includes(attr.name)) {
          if (attr.name === 'src' && !/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(attr.value)) element.removeAttribute(attr.name);
        } else if (!['colspan','rowspan'].includes(attr.name)) element.removeAttribute(attr.name);
      }
      if (element.tagName === 'IMG' && (!element.hasAttribute('src') || !element.getAttribute('alt')?.trim())) element.remove();
      else if (element.tagName === 'IMG') { element.loading = 'lazy'; element.decoding = 'async'; }
      if (element.tagName === 'A') {
        const href = element.getAttribute('href') || '';
        if (/^https?:/i.test(href)) { element.target = '_blank'; element.rel = 'noopener noreferrer'; }
        if (/\.md(?:#.*)?$/i.test(href)) {
          let decoded = href;
          try { decoded = decodeURIComponent(href); } catch (_) {}
          const number = decoded.match(/(?:^|\/)(\d{2})_/);
          const chapter = number && window.__STUDY_PACK__.chapters.find(ch => ch.id.match(/(\d{2})$/)?.[1] === number[1]);
          if (chapter) { element.href = '#'; element.dataset.chapter = chapter.id; }
          else element.removeAttribute('href');
        }
      }
    }
    for (const table of template.content.querySelectorAll('table')) {
      const headers = [...table.querySelectorAll('thead th')];
      const rows = [...table.querySelectorAll('tbody tr')];
      if (headers.length && rows.length && !table.querySelector('[colspan], [rowspan]') && rows.every(row => row.children.length === headers.length)) {
        table.classList.add('mobile-card-table');
        table.setAttribute('role', 'table');
        rows.forEach(row => {
          row.setAttribute('role', 'row');
          [...row.children].forEach((cell, index) => {
            cell.setAttribute('role', 'cell');
            const label = document.createElement('span');
            label.className = 'mobile-cell-label'; label.setAttribute('aria-hidden', 'true');
            label.textContent = headers[index].textContent;
            cell.prepend(label);
          });
        });
      }
      const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0;
      wrapper.setAttribute('aria-label', table.classList.contains('mobile-card-table') ? '教材對照表' : '表格，可左右捲動'); table.replaceWith(wrapper); wrapper.append(table);
    }
    return template.innerHTML;
  }
  window.StudyContent = {render};
})();
