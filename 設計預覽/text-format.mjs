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
  .replace(/！/g,'。').replace(/。{2,}/g,'。');
}
// 僅作用於已安全渲染的文字區段，不碰 href、data-answer 或題目選項。
const number=String.raw`(?:\d[\d,]*(?:\.\d+)?|[零〇一二三四五六七八九十百千萬億兩]+)`;
const unit='(?:個營業日|營業日|工作日|個工作天|工作天|個月|小時|分鐘|萬公噸|公噸|萬元|億元|美元|元|年|月|日|天|時|倍|期|家|歲|人|條|項|款|次|成|種|%|％|°C)';
const quantity=number+String.raw`\s*`+unit;
const expression=new RegExp(String.raw`(?:不得超過|不超過|不得逾|不得低於|至少|至多|最長|最高|最低|超過|未達|達到|達|每|連續)?\s*(?:${quantity}(?:\s*${quantity})*(?:\s*(?:至|到|～|~|／|/)\s*${quantity})?(?:\s*(?:以前|以後|以上|以下|以內|之前|之後|內|前|後|起))?|[一二三四五六七八九十]+分之[一二三四五六七八九十]+(?:以上|以下)?|\d+\s*/\s*\d+|過半數|立即|即刻)`,'g');
export function emphasizeHtml(html) {
 return html.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part:part.replace(expression,text=>'<strong class="legal-value">'+text+'</strong>')).join('');
}
