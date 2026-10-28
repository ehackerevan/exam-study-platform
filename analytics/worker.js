const allowedOrigin = 'https://ehackerevan.github.io';
const maxBytes = 512;
const coursePrefixes = {
  'trust-exam': ['past-'],
  'fintech-exam-pack': ['ft-'],
  'consumer-finance-exam-pack': ['cf-'],
  'esg-sustainability-pack': ['esg-'],
  'aml-cft-exam-pack': ['aml-'],
  'financial-market-ethics-official-bank-113': ['financial-market-', 'professional-ethics-'],
  'financial-market-ethics-official-bank-116': ['financial-market-', 'professional-ethics-'],
  'investment-insurance-exam': ['investment-'],
  'derivatives-sales-exam': ['derivatives-']
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!((request.method === 'POST' && url.pathname === '/event') || (request.method === 'GET' && url.pathname === '/counts'))) return new Response(null, {status: 404});
    if (request.headers.get('Origin') !== allowedOrigin) return new Response(null, {status: 403});
    const headers = {'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin', 'Cache-Control': 'no-store'};
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return new Response(null, {status: 403});
    if (!(await env.RATE_LIMITER.limit({key: ip})).success) return new Response(null, {status: 429, headers});
    if (request.method === 'GET') {
      const course = url.searchParams.get('course');
      if ((course !== null && !Object.hasOwn(coursePrefixes, course)) || [...url.searchParams.keys()].some(key => key !== 'course') || url.searchParams.getAll('course').length > 1) return new Response(null, {status: 400, headers});
      try {
        const statement = course === null
          ? env.DB.prepare('SELECT course, type, SUM(count) AS total FROM counts GROUP BY course, type')
          : env.DB.prepare('SELECT course, type, SUM(count) AS total FROM counts WHERE course = ?1 GROUP BY course, type').bind(course);
        const totals = await statement.all();
        const questions = course === null ? {results: []} : await env.DB.prepare("SELECT question, SUM(count) AS total FROM counts WHERE type = 'answer' AND course = ?1 GROUP BY question").bind(course).all();
        return Response.json({totals: totals.results, questions: questions.results}, {headers});
      } catch { return new Response(null, {status: 503, headers}); }
    }
    if (!request.body) return new Response(null, {status: 400});
    const reader = request.body.getReader();
    let size = 0;
    const chunks = [];
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return new Response(null, {status: 413}); }
      chunks.push(value);
    }
    let event;
    try {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      event = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
    } catch { return new Response(null, {status: 400}); }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !['view', 'answer'].includes(event.type) || typeof event.course !== 'string' ||
      !Object.hasOwn(coursePrefixes, event.course) ||
      (event.type === 'answer' && (typeof event.question !== 'string' || !/^[a-zA-Z0-9\u4e00-\u9fff_-]{1,80}$/.test(event.question) || !/\d$/.test(event.question) || !coursePrefixes[event.course].some(prefix => event.question.startsWith(prefix)))) ||
      (event.type === 'view' && event.question !== undefined) ||
      Object.keys(event).some(key => !['type', 'course', 'question'].includes(key))) return new Response(null, {status: 400});
    try {
      await env.DB.prepare(`INSERT INTO counts (day, type, course, question, count) VALUES (?1, ?2, ?3, ?4, 1)
        ON CONFLICT (day, type, course, question) DO UPDATE SET count = count + 1`)
        .bind(new Date().toISOString().slice(0, 10), event.type, event.course, event.question || '').run();
      return new Response(null, {status: 204, headers});
    } catch {
      return new Response(null, {status: 503, headers});
    }
  }
};
