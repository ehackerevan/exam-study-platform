(function () {
  'use strict';
  function evaluate(pack, progress) {
    const ids = new Set(pack.questions.map(question => question.id));
    if (!progress || progress.format !== 'study-pack-progress-v1' || progress.packId !== pack.id ||
        !progress.questionStats || typeof progress.questionStats !== 'object' || Array.isArray(progress.questionStats)) throw Error('成就進度無法讀取');
    let practiced = 0, correct = 0;
    for (const [id, stats] of Object.entries(progress.questionStats)) {
      if (!stats || !['attempts', 'wrongCount', 'correctCount'].every(key => Number.isSafeInteger(stats[key]) && stats[key] >= 0) ||
          stats.attempts !== stats.wrongCount + stats.correctCount || typeof stats.lastResult !== 'boolean') throw Error('成就進度無法讀取');
      if (ids.has(id)) { if (stats.attempts > 0) practiced++; if (stats.correctCount > 0) correct++; }
    }
    const total = ids.size, xp = 2 * practiced + 3 * correct;
    const level = total ? xp * 100 >= 80 * 5 * total ? 4 : xp * 100 >= 50 * 5 * total ? 3 : xp * 100 >= 20 * 5 * total ? 2 : 1 : 0;
    const badges = [
      ['first-step', '開始探索', practiced, 1],
      ['explorer-10', '探索十題', practiced, 10],
      ['explorer-50', '探索五十題', practiced, 50],
      ['correct-10', '十題突破', correct, 10],
      ['coverage-half', '半程足跡', practiced, Math.ceil(total / 2)],
      ['correct-half', '基礎累積', correct, Math.ceil(total / 2)],
      ['coverage-all', '全題庫足跡', practiced, total]
    ].map(([id, name, count, target]) => ({id, name, count, target, applicable: total > 0 && target <= total, unlocked: total > 0 && target <= total && count >= target}));
    const next = badges.filter(badge => badge.applicable && !badge.unlocked).sort((a, b) => b.count * a.target - a.count * b.target)[0] || null;
    return {total, practiced, correct, xp, level, title: ['', '起步者', '探索者', '練習家', '持續精進'][level], badges, next};
  }
  function render(container, result, scope) {
    container.replaceChildren();
    const text = (tag, value, className = '') => { const element = document.createElement(tag); element.textContent = value; element.className = className; return element; };
    container.append(text('p', scope, 'achievement-scope'));
    if (!result) { container.append(text('p', '成就暫不可用；請確認進度已保存，或重新載入頁面。', 'achievement-status')); return; }
    if (!result.total) { container.append(text('p', '本題庫暫無可計算題目')); return; }
    container.append(text('p', `L${result.level} ${result.title} · ${result.xp} / ${5 * result.total} EXP`, 'achievement-level'));
    container.append(text('p', result.next ? `下一枚：${result.next.name} · 還差 ${result.next.target - result.next.count} 道${result.next.id.startsWith('correct') ? '曾答對的' : '已作答的'}不同題目` : '全部達成，繼續複習錯題與解析。', 'achievement-next'));
    const grid = document.createElement('ul'); grid.className = 'achievement-grid';
    for (const badge of result.badges) {
      const item = text('li', '', 'achievement-badge' + (badge.unlocked ? ' unlocked' : ''));
      item.dataset.achievement = badge.id;
      item.append(text('strong', `${badge.unlocked ? '✓ ' : ''}${badge.name}`), text('span', badge.applicable ? `${badge.unlocked ? '已達成' : '尚未達成'} · ${badge.count} / ${badge.target} 題` : '本題庫不適用'));
      grid.append(item);
    }
    container.append(grid, text('p', '依目前保存紀錄與題庫計算；還原、重設或題庫改版後可能降低。每道新題 +2 EXP，首次答對 +3 EXP；重刷不累加。', 'achievement-note'));
  }
  window.StudyAchievements = {evaluate, render};
})();
