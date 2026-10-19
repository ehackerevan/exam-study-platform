/**
 * 簡易而安全的 HTML 與文字淨化工具，防範 XSS
 */
export function sanitizeHtml(htmlStr) {
  if (typeof htmlStr !== 'string') return '';
  
  // 移除 <script> 標籤及其內容
  let sanitized = htmlStr.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 移除行內事件處理器 (如 onclick, onerror, onload...)
  sanitized = sanitized.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^>\s]+/gi, '');

  // 移除 javascript: 偽協議
  sanitized = sanitized.replace(/href\s*=\s*(['"])\s*javascript:.*?\1/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*(['"])\s*javascript:.*?\1/gi, 'src=""');

  return sanitized;
}

/**
 * 跳脫 HTML 特殊字元
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 簡易 slugify 工具，用於產生章節 ID
 */
export function slugify(str, fallback = 'item') {
  if (!str || typeof str !== 'string') return fallback;
  const clean = str
    .toLowerCase()
    .trim()
    .replace(/[\s\t\n]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff-]/g, '')
    .replace(/-+/g, '-');
  return clean || fallback;
}
