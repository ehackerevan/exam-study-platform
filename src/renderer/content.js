(function () {
  const teachingClasses = new Set('law-reference table-wide table-narrow knowledge-topic topic-core topic-diagram topic-flow rule-content topic-example topic-trap legal-value table-compact source-excerpt chapter-review chapter-sources understanding question-line check-answer concept-map map-heading map-kind map compare map-node step-index map-track step-details step-detail map-footer step-hint next-step is-selected'.split(' '));
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function diagram(source) {
    const labels = new Map();
    const node = /\b([A-Za-z][\w-]*)\s*(?:\["([^"]+)"\]|\[([^\]]+)\]|\("([^"]+)"\)|\(([^)]+)\)|\{"([^"]+)"\}|\{([^}]+)\})/g;
    for (const match of source.matchAll(node)) labels.set(match[1], match.slice(2).find(value => value !== undefined).replace(/<br\s*\/?>/gi, ' '));
    const rows = [], groups = new Map();
    for (const line of source.split('\n')) {
      const pie = line.match(/^\s*"([^"]+)"\s*:\s*([\d.]+)/);
      if (pie) rows.push(`<tr><td>${escape(pie[1])}</td><td>${escape(pie[2])}</td></tr>`);
      const edge = line.replace(node, (_, id) => id).match(/^\s*([A-Za-z][\w-]*)\s*(?:-->|---|-.->|==>)\s*(?:\|([^|]+)\|)?\s*([A-Za-z][\w-]*)/);
      if (edge) {
        if (!groups.has(edge[1])) groups.set(edge[1], []);
        groups.get(edge[1]).push(`${edge[2] ? `<strong>${edge[2].split(/<br\s*\/?>/i).map(escape).join('<br>')}</strong>：` : ''}${escape(labels.get(edge[3]) || edge[3])}`);
      }
    }
    // shortcut: current course diagrams use simple edges; retain unfamiliar syntax as a text alternative.
    if (groups.size) return [...groups].map(([id, items]) => `<p><strong>${escape(labels.get(id) || id)}</strong></p><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`).join('');
    return rows.length ? `<div class="table-scroll" tabindex="0" aria-label="關係圖文字對照"><table><caption>概念關係對照</caption><tbody>${rows.join('')}</tbody></table></div>` : `<details><summary>概念圖文字版</summary><pre>${escape(source)}</pre></details>`;
  }
  function render(raw) {
    const source = window.StudyTypography.readableText(raw).replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, body) => '\n\n' + diagram(body) + '\n\n');
    const template = document.createElement('template');
    template.innerHTML = window.marked.parse(source, {gfm:true, breaks:true});
    const allowed = new Set('P BR STRONG EM DEL S UL OL LI BLOCKQUOTE PRE CODE H1 H2 H3 H4 H5 H6 HR TABLE CAPTION THEAD TBODY TR TH TD A IMG DIV DETAILS SUMMARY SPAN SUP SUB SECTION BUTTON'.split(' '));
    for (const element of [...template.content.querySelectorAll('*')]) {
      if (!allowed.has(element.tagName)) { element.remove(); continue; }
      for (const attr of [...element.attributes]) {
        if(attr.name==='class'){const classes=attr.value.split(/\s+/).filter(name=>teachingClasses.has(name));if(classes.length)element.className=classes.join(' ');else element.removeAttribute('class');}
        else if(element.tagName==='BUTTON' && attr.name==='type')element.type='button';
        else if(attr.name==='aria-label'){}
        else if(element.tagName==='BUTTON' && attr.name==='aria-pressed' && /^(true|false)$/.test(attr.value)){}
        else if(attr.name==='id' && element.classList.contains('step-detail') && /^[a-z][\w-]*-step-\d+$/.test(attr.value)){}
        else if(element.tagName==='BUTTON' && attr.name==='aria-controls' && /^[a-z][\w-]*-step-\d+$/.test(attr.value)){}
        else if (element.tagName === 'A' && attr.name === 'href') {
          if (!/^(https?:\/\/|#|[^:/?#]+\.md(?:#.*)?$)/i.test(attr.value.trim())) element.removeAttribute('href');
        } else if (element.tagName === 'IMG' && ['src','alt'].includes(attr.name)) {
          if (attr.name === 'src' && !/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(attr.value)) element.removeAttribute(attr.name);
        } else if (!['colspan','rowspan'].includes(attr.name)) element.removeAttribute(attr.name);
      }
      if(element.tagName==='BUTTON')element.type='button';
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
      if(!table.classList.contains('table-wide')&&!table.classList.contains('table-narrow'))table.classList.add(table.rows[0]?.cells.length>2?'table-wide':'table-narrow');
      if(table.parentElement?.classList.contains('table-scroll'))continue;
      const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0;
      wrapper.setAttribute('aria-label', '表格，可左右捲動'); table.replaceWith(wrapper); wrapper.append(table);
    }
    return template.innerHTML;
  }
  function initTeaching(container){
    for(const map of container.querySelectorAll('.concept-map')){
      const buttons=[...map.querySelectorAll('.map-node')],details=[...map.querySelectorAll('.step-detail')],next=map.querySelector('.next-step');
      if(!buttons.length||!next)continue;
      let selected=0;
      const select=index=>{selected=index;buttons.forEach((button,i)=>{button.classList.toggle('is-selected',i===index);button.setAttribute('aria-pressed',String(i===index));});details.forEach((detail,i)=>detail.hidden=i!==index);next.textContent=index===buttons.length-1?'再看一次 ↺':'下一步 →';};
      buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
      next.addEventListener('click',()=>select((selected+1)%buttons.length));select(0);
    }
  }
  window.StudyContent = {render,initTeaching};
})();
