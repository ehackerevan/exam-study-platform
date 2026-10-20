(function () {
  const scope = '.section-body,.section-title,.chapter-title,.chapter-summary,.learning-goals,.keypoints-list,.notes-box,.explanation-text';
  const excluded = 'script,style,textarea,input,select,option,code,pre,mark.legal-term,[contenteditable]';
  const words = /不可以|不得|不可|不應|禁止|必須|應當|可以|應|得|可/g;
  const number = '[0-9０-９零〇一二三四五六七八九十百千萬億兆兩半]+(?:[.,，．點][0-9０-９零〇一二三四五六七八九十百千萬億兆兩半]+)*';
  const units = '(?:個工作日|個營業日|個月|工作日|工作天|營業日|日曆日|億元|萬元|元|圓|萬|億|年|月|天|日|小時|分鐘|週|星期|%|％|倍)';
  const quantity = `(?:新臺幣|新台幣|人民幣|美元|美金|港幣|日圓|歐元|NT\\$|US\\$|USD|\\$)\\s*${number}(?:\\s*${units})?(?:以上|以下|以內|內|前|後)?|百分之${number}|${number}\\s*${units}(?:以上|以下|以內|內|前|後)?|年限|金額|期限|時限|限額`;
  const terms = new RegExp(`(?<quantity>${quantity})|${words.source}`, 'g');
  function highlight(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue, matches = [...text.matchAll(terms)].filter(match => {
        const before = text.slice(Math.max(0, match.index - 3), match.index), after = text.slice(match.index + match[0].length);
        if (match[0] === '得' && (/(?:取|獲|所|值|覺|記|心|贏|難|喜|懂|博)$/.test(before) || /^(?:分|失|意|到|獎|知|利|力|益|手|罪)/.test(after))) return false;
        if (match[0] === '可' && /^(?:能|惜|怕|愛|靠|觀|口|憐|惡|見|行|是|不可以)/.test(after)) return false;
        if (match[0] === '應' && (/(?:效|反|回|對|相|因|響|供|適|呼|承)$/.test(before) || /^(?:用|對|變|收|付)/.test(after))) return false;
        return !(match[0] === '不得' && /^[不已]/.test(after)) && !(match[0] === '不可' && text.slice(match.index).startsWith('不可或缺'));
      });
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();let position = 0;
      for (const match of matches) {
        fragment.append(text.slice(position,match.index));
        const mark = document.createElement('mark');
        mark.className = 'legal-term ' + (match.groups.quantity !== undefined ? 'legal-quantity' : /^(不|禁止)/.test(match[0]) ? 'legal-prohibit' : /^(應|必須)/.test(match[0]) ? 'legal-duty' : 'legal-permit');
        mark.textContent = match[0];fragment.append(mark);position = match.index + match[0].length;
      }
      fragment.append(text.slice(position));node.replaceWith(fragment);
    }
  }
  const scan = root => {
    if (root.nodeType !== 1 || root.closest(excluded)) return;
    const parent = root.closest(scope);
    if (parent) highlight(parent);
    else root.querySelectorAll(scope).forEach(highlight);
  };
  new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1) roots.add(node);
      else if (node.nodeType === 3 && node.parentElement && !node.parentElement.closest(excluded)) roots.add(node.parentElement);
    }
    roots.forEach(scan);
  }).observe(document.documentElement,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>scan(document.body));
  else scan(document.body);
})();
