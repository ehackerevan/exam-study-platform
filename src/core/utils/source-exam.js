export function parseSourceExam(question, defaultSubject = '') {
  if (question?.sourceExam) return question.sourceExam;
  if (Number.isSafeInteger(question?.p) && Number.isSafeInteger(question?.n)) {
    const subject = question.s === 1 ? '信託法規' : question.s === 2 ? '信託實務' : defaultSubject;
    if (subject) return { term: `第 ${question.p} 期`, subject, number: question.n };
  }
  if (Number.isSafeInteger(question?.period) && Number.isSafeInteger(question?.number) && question?.subject) {
    return { term: `第 ${question.period} 期`, subject: question.subject, number: question.number };
  }

  const text = typeof question === 'string' ? question : question?.question;
  if (typeof text !== 'string') return null;

  let match = text.match(/【第\s*(\d+)\s*屆\s*([^】]*?)\s*第\s*(\d+)\s*題】/);
  if (match) return { term: `第 ${match[1]} 屆`, subject: match[2].trim() || defaultSubject, number: Number(match[3]) };

  match = text.match(/【場次\s*(\d{3})-(\d+)\s*第\s*(\d+)\s*題】/);
  if (match) return { term: `${match[1]}-${match[2]}`, subject: defaultSubject, number: Number(match[3]) };

  match = text.match(/【場次\s*(\d{3})年?第(\d+)次\s*第\s*(\d+)\s*題】/);
  if (match) return { term: `${match[1]}年第${match[2]}次`, subject: defaultSubject, number: Number(match[3]) };

  return null;
}
