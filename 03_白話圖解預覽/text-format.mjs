const subscript = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
export function readableText(value) {
 return String(value??'')
  .replace(/\$([^$\n]+)\$/g,(_,math)=>math.replace(/\\times\b/g,'×').replace(/\\log\b/g,'log').replace(/\\ge\b/g,'≥').replace(/\\le\b/g,'≤'))
  .replace(/\b(CO|CH|N|SF|NF)_\{?(\d+)\}?/g,(_,formula,digits)=>formula+[...digits].map(d=>subscript[d]).join(''))
  .replace(/\b(CO2e?|CH4|N2O|SF6|NF3)\b/g,formula=>formula.replace(/\d/g,d=>subscript[d]))
  .replace(/<sub>(\d+)<\/sub>/gi,(_,digits)=>[...digits].map(d=>subscript[d]).join(''))
  .replace(/[\uFE0F\u20E3]/g,'');
}
export function conciseText(value) {
 return readableText(value)
  .replace(/消金本輪僅改呈現，未做逐題複核。|本輪未重新判定消金題目的法律或答案正確性。/g,'')
  .replace(/本章在歷屆[^。\n]*[。]\s*/g,'')
  .replace(/本章(?:歷屆必考出題|出題|命題)(?:四大|三大|兩大|核心|四|三|兩)?(?:重點|焦點|支柱|核心|考點)[：:]?/g,'重點：')
  .replace(/歷屆每期必考|機構別對應題秒殺|本輪僅改呈現，未做逐題複核|本輪未重新判定消金題目的法律或答案正確性/g,'')
  .replace(/消金本輪僅改呈現，未做逐題複核。|（曾於歷屆題目出現！）/g,'')
  .replace(/考前必背|必背百分比|必考金流情境|必考法理|必考考點|必考考點|必考重點|直擊出題文字坑|嚴格保護防線|守護神/g,'')
  .replace(/（\s*）|\(\s*\)/g,'')
  .replace(/三鐵律/g,'重點').replace(/([四五三兩二])大鐵律/g,'$1項重點')
  .replace(/秒殺|送分重點|拿下一大半/g,'重點')
  .replace(/題目問哪種債券資金可以當一般營運週轉？必選 SLB/g,'SLB 的募集資金可作一般營運用途，仍須核對債券條件')
  .replace(/麻袋裝滿的髒黑現金/g,'大額來路不明現金')
  .replace(/防止恐怖分子取得資金毀滅世界/g,'防堵恐怖主義融資')
  .replace(/雙雄世紀對決/g,'兩者對照')
  .replace(/逼上電支梁山/g,'納入電子支付機構管理')
  .replace(/兩個月（60天）定生死/g,'60 日內作成決定')
  .replace(/防彈衣（防火牆）/g,'防火牆')
  .replace(/銅牆鐵壁般的資安防護體系/g,'多層次資安防護體系')
  .replace(/定海神針/g,'核心準則')
  .replace(/(?:^|[。；\n])\s*(?:須依適用標準與既定準則判斷|仍應依題目事實與法規條文判斷，不能只憑關鍵字猜答案|須連同適用對象與版本判讀|此為來源教材的原始安排與提案紀錄，未判定現行效力)[。；]?/g,'')
  .replace(/！/g,'。').replace(/。{2,}/g,'。');
}
// 僅作用於已安全渲染的文字區段，不碰 href、data-answer 或題目選項。
const number=String.raw`(?:\d[\d,]*(?:\.\d+)?|[零〇一二三四五六七八九十百千萬億兩]+)`;
const unit='(?:個營業日|營業日|工作日|個工作天|工作天|個月|小時|分鐘|萬公噸|公噸|萬元|億元|美元|元|年|月|日|天|時|倍|期|家|歲|%|％|°C)';
const quantity=number+String.raw`\s*`+unit;
const expression=new RegExp(String.raw`(?<!第)(?:不得超過|不超過|不得逾|不得低於|至少|至多|最長|最高|最低|超過|未達|達到|達|每|連續)?\s*(?:${quantity}(?:\s*${quantity})*(?:\s*(?:至|到|～|~|／|/)\s*${quantity})?(?:\s*(?:以前|以後|以上|以下|以內|之前|之後|內|前|後|起))?|[一二三四五六七八九十]+分之[一二三四五六七八九十]+(?:以上|以下)?|\d+\s*/\s*\d+|過半數|立即|即刻)`,'g');
export function emphasizeHtml(html) {
 return html.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part:part.replace(expression,(text,offset,str)=>{
   if (offset > 0 && str[offset - 1] === '第') return text;
   if (/^(?:兩人|百年|兩手|一種|兩種|三種|四種)/.test(text)) return text;
   return '<strong class="legal-value">'+text+'</strong>';
 })).join('');
}
