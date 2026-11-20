/* PFI Construction Financial Workspace v1.0
 * Browser-only QA engine: source-backed, no database and no financial transaction writes.
 * All numbers remain provisional until independently reconciled/approved.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const state={docs:[],next:1,mode:'blank',busy:false,view:'overview',model:null};
const fields={
 name:{label:'Project name',aliases:['project name','investment name','development name','project title'],text:true},
 type:{label:'Property type',aliases:['property type','asset type'],text:true},
 city:{label:'City',aliases:['city'],text:true},state:{label:'State',aliases:['state'],text:true},
 units:{label:'Condominium units',aliases:['condominium units','condo units']},
 parking:{label:'Parking spaces',aliases:['parking spaces']},
 floors:{label:'Building floors',aliases:['building floors']},
 sf:{label:'Gross building SF',aliases:['gross building sf','gross building area']},
 land:{label:'Land acquisition',aliases:['land acquisition','land cost']},
 residential:{label:'Residential construction',aliases:['residential construction']},
 retailcost:{label:'Retail construction',aliases:['retail construction']},
 parkingcost:{label:'Parking construction',aliases:['parking construction']},
 indirect:{label:'Indirect development costs',aliases:['indirect development costs','indirect costs']},
 condosales:{label:'Condominium sales',aliases:['condominium sales revenue','condominium sales','condo sales revenue']},
 retailsales:{label:'Retail sales',aliases:['retail sale proceeds','retail sales']},
 salesexpenses:{label:'Selling expenses',aliases:['selling expenses','sales expenses']}
};
const budgetKeys=['land','residential','retailcost','parkingcost','indirect'];
const renderEsc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number.isFinite(n)?'$'+Math.round(n).toLocaleString('en-US'):'—';
const compact=n=>Number.isFinite(n)?'$'+(Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':Math.round(n).toLocaleString()):'—';
const integer=n=>Number.isFinite(n)?Math.round(n).toLocaleString('en-US'):'—';
const fieldDisplay=(k,v)=>typeof v==='number'?(['units','parking','floors','sf'].includes(k)?integer(v):money(v)):String(v??'—');
const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
const safeValue=(v)=>{if(typeof v==='number')return Number.isFinite(v)?v:'';if(v instanceof Date)return v.toISOString().slice(0,7);return String(v==null?'':v).trim()};
function nval(v,percent){const t=String(v??'').trim().replace(/^\s*["']/,'').replace(/["']\s*$/,'');if(!t||!/^[$\s()0-9,.%+-]/.test(t))return null;const s=t.replace(/[,$\s]/g,'').replace(/[()]/g,'').replace(/%/g,'');if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))return null;let n=Number(s);if(!Number.isFinite(n))return null;if(percent||t.includes('%'))n/=100;return n}
function cleanLine(s){return String(s||'').replace(/\u00a0/g,' ').replace(/^\s*["']|["']\s*$/g,'').replace(/\s+/g,' ').trim()}
function classify(name,text,sheets){const normalized=name.replace(/[_-]/g,' ').replace(/\s+/g,' ').toLowerCase();const q=(normalized+' '+text.slice(0,4000)).toLowerCase(),sheetNames=Object.keys(sheets||{}).join(' ').toLowerCase();
 if(/conflicting|superseded|unapproved revision/.test(normalized))return 'REVISED / UNAPPROVED';
 if(/master underwriting|master deal intake|integrated financial|master entry|simple key values/.test(normalized))return 'MASTER UNDERWRITING';
 if(/investment memo|investment memorandum/.test(normalized))return 'INVESTMENT MEMO';
 if(/lender term|loan term/.test(normalized))return 'LENDER TERMS';
 if(/approved change order|pending change order|contract change order/.test(normalized))return /status:\s*approved\b/i.test(text)?'APPROVED CHANGE ORDER':'PENDING / UNVERIFIED CHANGE';
 if(/pay application|progress payment|invoice and payment|invoice dispute/.test(normalized))return 'CONSTRUCTION BILLING';
 if(/construction schedule|draw plan|monthly draw/.test(normalized))return 'PROJECT SCHEDULE';
 if(/rent roll/.test(normalized))return 'RENT ROLL / SEPARATE USE';
 if(/unit sellout/.test(normalized))return 'UNIT SELLOUT';
 if(/development budget/.test(normalized))return 'DEVELOPMENT BUDGET';
 if(/zoning|civil review|environmental|title and flood|permit/.test(normalized))return 'DUE DILIGENCE';
 if(/purchase agreement|acquisition/.test(normalized))return 'ACQUISITION / CONTRACT';
 if(/gmp contract|construction contract/.test(normalized))return 'CONSTRUCTION CONTRACT';
 if(/sales contract|closing control/.test(normalized))return 'SALES / CLOSING';
 if(/market comparables|absorption/.test(normalized))return 'MARKET STUDY';
 if(/equity syndication/.test(normalized))return 'EQUITY / INVESTOR';if(/(conflicting.revision|revision status:|superseded)/i.test(q)||/(conflicting revision)/i.test(name))return 'REVISED / UNAPPROVED';
 if(/(master deal intake|master underwriting cover|master input)/.test(q+' '+sheetNames))return 'MASTER UNDERWRITING';
 if(/change order|pending contract change|contract change/.test(q)){if(/status:\s*approved\b/i.test(text))return 'APPROVED CHANGE ORDER';return 'PENDING / UNVERIFIED CHANGE';}
 if(/(payment application|pay application|progress payment|payapp|invoice and payment)/.test(q))return 'CONSTRUCTION BILLING';
 if(/loan term|lender term/.test(q))return 'LENDER TERMS';
 if(/rent roll|unit rent/.test(q))return 'RENT ROLL / SEPARATE USE';
 if(/(monthly draws|construction schedule|draw plan)/.test(q+' '+sheetNames))return 'PROJECT SCHEDULE';
 if(/(unit sellout|condominium sellout)/.test(q+' '+sheetNames))return 'UNIT SELLOUT';
 if(/(development budget|hard cost|cost budget|sources and uses)/.test(q))return 'DEVELOPMENT BUDGET';
 if(/(zoning|civil review|flood|permit|environmental|title review)/.test(q))return 'DUE DILIGENCE';
 if(/(purchase agreement|acquisition)/.test(q))return 'ACQUISITION / CONTRACT';
 if(/(investor|lp\/gp|preferred return|syndication)/.test(q))return 'EQUITY / INVESTOR';
 if(/(investment memo|underwriting)/.test(q))return 'INVESTMENT MEMO';
 return 'GENERAL DEVELOPMENT DOCUMENT';}
function score(doc,field){if(doc.kind==='REVISED / UNAPPROVED'||doc.kind==='RENT ROLL / SEPARATE USE'||doc.kind==='PENDING / UNVERIFIED CHANGE')return -999;
 if(/MASTER INPUT/.test(field.location||''))return 120;
 if(doc.kind==='MASTER UNDERWRITING')return 110;
 if(doc.kind==='DEVELOPMENT BUDGET')return 95;
 if(/simple.key.values/i.test(doc.name))return 90;
 if(doc.kind==='INVESTMENT MEMO')return 75;
 return 55;
}
function fieldExtract(doc){
 const out=[];
 const add=(raw,location)=>{
  const line=cleanLine(raw);if(!line||line.length>550)return;
  for(const [key,def] of Object.entries(fields)){
   for(const label of def.aliases){
    const low=line.toLowerCase(),tag=label.toLowerCase();
    if(!low.startsWith(tag))continue;
    const tail=line.slice(tag.length).trim();
    if(!/^[:=,|]/.test(tail))continue;
    const original=tail.slice(1).trim();
    const first=original.split(/\s+\|\s+|;\s*/)[0].trim();
    const value=def.text?first:nval(first);
    if(value===null||value===''||(typeof value==='number'&&value<0))continue;
    out.push({key,value,source:doc.name,location,evidence:line,score:score(doc,{location})});
    return;
   }
  }
 };
 (doc.lines||[]).forEach((s,i)=>add(s,'Line '+(i+1)));
 for(const [sheet,rows] of Object.entries(doc.sheets||{})){
  const last=Math.min(rows.length,2000);
  for(let i=0;i<last;i++){
   const row=rows[i]||[];
   if(row.length>=2){
    const value=safeValue(row[1]),label=safeValue(row[0]);
    if(label&&value) add(label+': '+value+' | '+safeValue(row[2]||''),sheet+'!row '+(i+1));
    if(row[0]&&typeof row[0]==='string'&&row[0].includes(':'))add(row[0],sheet+'!row '+(i+1));
   }
  }
 }
 const seen=new Set();doc.fields=out.filter(f=>{const k=f.key+'|'+String(f.value)+'|'+f.location;if(seen.has(k))return false;seen.add(k);return true});
}
async function parsePDF(bytes){
 if(!window.pdfjsLib)throw Error('PDF reader failed to load. Reload the page and try again.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdf.worker.min.js';
 // Important for Safari/WebKit: Uint8Array instances returned by JSZip are
 // sometimes backed by non-transferable storage. Handing that view directly
 // to the PDF.js worker can throw "The object can not be cloned."
 // A Blob URL makes the worker fetch standard bytes, avoiding that transfer.
 const independent=new Uint8Array(bytes.byteLength);
 independent.set(bytes);
 let blobUrl=null,pdf=null,lastError=null;
 const options={useSystemFonts:true,isEvalSupported:false};
 try{
  blobUrl=URL.createObjectURL(new Blob([independent],{type:'application/pdf'}));
  try{
   pdf=await pdfjsLib.getDocument({...options,url:blobUrl}).promise;
  }catch(err){
   lastError=err;
   // Some privacy configurations block blob reads inside workers. Retry
   // with a fresh, dedicated ArrayBuffer (never with the JSZip input view).
   const retryData=new Uint8Array(independent.byteLength);
   retryData.set(independent);
   try{pdf=await pdfjsLib.getDocument({...options,data:retryData}).promise}
   catch(err2){
    throw new Error('PDF parser could not read this file (URL mode: '+String(lastError?.message||lastError)+'; byte mode: '+String(err2?.message||err2)+').');
   }
  }
  const lines=[];
 for(let p=1;p<=Math.min(pdf.numPages,130);p++){
  const pg=await pdf.getPage(p),c=await pg.getTextContent(),byY=[];
  // Arrange PDF glyphs into visual lines so labeled amounts are extractable.
  for(const item of c.items){
   if(!item.str||!item.str.trim())continue;
   const y=item.transform?.[5]??0,x=item.transform?.[4]??0;
   let line=byY.find(z=>Math.abs(z.y-y)<3);
   if(!line){line={y,items:[]};byY.push(line)}
   line.items.push({x,s:item.str})
  }
  byY.sort((a,b)=>b.y-a.y);
  for(const ln of byY){ln.items.sort((a,b)=>a.x-b.x);lines.push(ln.items.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim())}
 }
 if(!lines.some(s=>s))throw Error('This PDF has no selectable text. Image-only scans need OCR, which is not yet enabled.');
 return {lines,sheets:{},pages:pdf.numPages};
 }finally{
  if(pdf)try{await pdf.destroy()}catch(_){/* ignore teardown failure */}
  if(blobUrl)URL.revokeObjectURL(blobUrl);
 }
}
async function parseExcel(bytes){if(!window.XLSX)throw Error('Excel reader failed to load. Reload and try again.');
 const wb=XLSX.read(bytes,{type:'array',cellDates:false,cellFormula:false});const sheets={};let lines=[];
 for(const name of wb.SheetNames.slice(0,65)){
  const arr=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true});
  sheets[name]=arr.slice(0,1500).map(row=>row.slice(0,30).map(safeValue));
  for(const row of sheets[name]){const cells=row.filter(x=>x!==''&&!/^\s*$/.test(String(x)));if(cells.length)lines.push(cells.join(' | '));}
 }
 return {lines:lines.slice(0,4000),sheets};
}
async function parseDOCX(bytes){if(!window.JSZip)throw Error('Word reader unavailable.');const zip=await JSZip.loadAsync(bytes);
 const part=zip.file('word/document.xml');if(!part)throw Error('Word document has no readable content.');
 const xml=await part.async('string');const dom=new DOMParser().parseFromString(xml,'application/xml');const ps=Array.from(dom.getElementsByTagName('w:p'));const lines=ps.map(p=>Array.from(p.getElementsByTagName('w:t')).map(n=>n.textContent).join('')).filter(Boolean);
 return {lines,sheets:{}}}
function fromPlain(name,bytes){const txt=new TextDecoder().decode(bytes),ext=name.split('.').pop().toLowerCase();let lines=txt.split(/\r?\n/),sheets={};
 if(ext==='json'){try{
  const obj=JSON.parse(txt);lines=[];function walk(v,k,depth){if(depth>4||lines.length>6000)return;if(Array.isArray(v)){v.slice(0,150).forEach((x,i)=>walk(x,k+'['+i+']',depth+1));return}if(v&&typeof v==='object'){Object.entries(v).slice(0,80).forEach(([a,x])=>walk(x,a,depth+1));return}lines.push(k+': '+String(v))}walk(obj,'',0);
 }catch(e){throw Error('Invalid JSON: '+e.message)}}
 if(ext==='csv'){try{const wb=XLSX.read(txt,{type:'string'}),a=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});sheets['CSV']=a.slice(0,2500);lines=lines.concat(a.slice(0,2500).map(r=>r.map(safeValue).join(' | ')))}catch(e){/* retain text-based field parsing */}}
 return {lines:lines.slice(0,9000),sheets}}
function docRisks(doc){
 const txt=doc.lines.join('\n'),risk=[];
 if(doc.kind==='REVISED / UNAPPROVED')risk.push('Superseded or unapproved source: values excluded from automatic model.');
 if(doc.kind==='PENDING / UNVERIFIED CHANGE')risk.push('Pending change order: do not modify the project budget.');
 if(doc.kind==='CONSTRUCTION BILLING')risk.push('Payment request is not certified. No payment or payable has been created.');
 if(doc.kind==='LENDER TERMS')risk.push('Indicative lender terms only; no borrowing or rate is approved.');
 if(doc.kind==='RENT ROLL / SEPARATE USE')risk.push('Rental schedule is not evidence of condominium sellout; not included in project units.');
 if(!doc.fields.length&&!Object.keys(doc.sheets).length)risk.push('Document was read successfully; no direct master financial fields were mapped. Evidence retained for review.');
 if(/not executed|not verified|not started|unexecuted/i.test(txt)&&doc.kind!=='MASTER UNDERWRITING')risk.push('Unexecuted or unverified requirement may require approval.');
 return risk;
}
function getRow(sheets,possible){for(const [name,rows] of Object.entries(sheets)){if(possible.some(rx=>rx.test(name)))return rows}return []}
function rowNum(row,i){return nval(row?.[i])}
function routeInfo(doc,m){
 // Routes are review assignments, not accounting postings or investment approvals.
 const kinds={
  'INVESTMENT MEMO':['overview','budget','capital','sellout'],
  'MASTER UNDERWRITING':['overview','budget','capital','cashflow','sellout','diligence'],
  'DEVELOPMENT BUDGET':['budget','overview','capital'],
  'LENDER TERMS':['capital','cashflow','exceptions'],
  'PROJECT SCHEDULE':['cashflow','diligence'],
  'CONSTRUCTION BILLING':['capital','exceptions'],
  'DUE DILIGENCE':['diligence','exceptions'],
  'APPROVED CHANGE ORDER':['capital','budget','exceptions'],
  'PENDING / UNVERIFIED CHANGE':['capital','budget','exceptions'],
  'RENT ROLL / SEPARATE USE':['exceptions'],
  'REVISED / UNAPPROVED':['exceptions','budget'],
  'ACQUISITION / CONTRACT':['budget','diligence'],
  'CONSTRUCTION CONTRACT':['capital','budget'],
  'SALES / CLOSING':['sellout','diligence'],
  'MARKET STUDY':['sellout','overview'],
  'EQUITY / INVESTOR':['capital','exceptions'],
  'UNIT SELLOUT':['sellout'],
  'GENERAL DEVELOPMENT DOCUMENT':['overview','exceptions']
 };
 let routes=(kinds[doc.kind]||['exceptions']).slice();
 const count={
  fieldValues:Object.entries(m.sources||{}).filter(([k,src])=>src.source===doc.name).length,
  drawMonths:m.draws.length&&doc.draws?.length&&doc.draws===m.draws?m.draws.length:0,
  selloutUnits:m.sellout.length&&doc.sellout?.length&&doc.sellout===m.sellout?m.sellout.length:0,
  commitments:doc.commitments?.length||0,
  diligence:((doc.permits?.length||0)+(doc.risks?.length||0)),
  activities:doc.scheduleActivities?.length||0,
  invoices:doc.invoiceDisputes?.length||0,
  changeOrders:doc.change&&m.changes.some(c=>c.source===doc.name)?1:0,
  payments:doc.payment&&m.payments.some(c=>c.source===doc.name)&&Object.entries(doc.payment).some(([k,v])=>k!=='label'&&typeof v==='number')?1:0
 };
 let isDuplicate=m.duplicates.some(x=>x.id===doc.id);
 let excluded=['REVISED / UNAPPROVED','PENDING / UNVERIFIED CHANGE','RENT ROLL / SEPARATE USE'].includes(doc.kind);
 let counts=Object.values(count).reduce((a,b)=>a+b,0);
 let routeStatus=isDuplicate?'DUPLICATE FORMAT':excluded?'EXCLUDED / REVIEW':counts?'MODEL + REVIEW':'REVIEW ONLY';
 let explanation=isDuplicate?'Alternate PDF / Word copy. Source retained; duplicate monetary entries not counted twice.'
  :excluded?'Excluded from base financial figures; inspect the exception before approving any change.'
  :counts?'Relevant structured evidence was routed to model/review panels. Other terms in this file still require review.'
  :'The file parsed successfully and is assigned for document review. Its substantive terms have not been validated or posted.';
 if(doc.kind==='RENT ROLL / SEPARATE USE')explanation='Separate rental rent roll; must not be confused with the 96-unit condominium sellout. CRE model is independent and is not auto-populated.';
 if(doc.kind==='LENDER TERMS')explanation='Indicative lender terms extracted as review evidence; no binding loan, debt approval or interest posting.';
 if(doc.kind==='PROJECT SCHEDULE')explanation='Dated construction activities routed to schedule review. Source-provided 36-month cash flow comes from the integrated workbook.';
 if(doc.kind==='INVESTMENT MEMO')explanation='Investment assumptions and narrative for underwriting review; duplicate Word/PDF copies do not create two transactions.';
 if(doc.kind==='GENERAL DEVELOPMENT DOCUMENT')explanation='Nested assumptions recognized only where direct labels match. Unmapped JSON keys remain for human review.';
 if(doc.kind==='CONSTRUCTION BILLING')explanation='Contractor invoice/pay-application evidence queued for construction review; not an approved payable.';
 if(doc.kind==='SALES / CLOSING')explanation='Presale and closing contract terms assigned to sellout review; no executed sale or cash receipt is inferred.';
 return {routes,status:routeStatus,explanation,counts};
}
const routeLabels={overview:'Executive Dashboard',documents:'Document Intake',routing:'Document Routing & Review',budget:'Development Budget',capital:'Capital & Construction',cashflow:'36-Month Cash Flow',sellout:'Unit Sellout',diligence:'Due Diligence',exceptions:'Exceptions & Controls'};
function routeBadge(r){return r.status==='MODEL + REVIEW'?'green':r.status==='REVIEW ONLY'?'':'critical'}
function renderRouting(m){
 const parsed=m.docs,failed=state.docs.filter(d=>d.status==='error');
 const unique=new Set(parsed.map(d=>d.name.replace(/\.(pdf|docx)$/i,'').replace(/^(\d+)_.*$/,'$1'))).size;
 let statuses={};for(const doc of parsed){const r=routeInfo(doc,m);statuses[r.status]=(statuses[r.status]||0)+1}
 const tag=(label,n)=>'<span class="tag">'+renderEsc(label)+' '+integer(n)+'</span>';
 $('route-stats').innerHTML=tag('Logical documents',unique)+tag('Files parsed',parsed.length)+tag('Mapped + review',statuses['MODEL + REVIEW']||0)+tag('Review only',statuses['REVIEW ONLY']||0)+tag('Excluded',statuses['EXCLUDED / REVIEW']||0)+tag('Alternate formats',statuses['DUPLICATE FORMAT']||0)+tag('File failures',failed.length);
 $('route-count').textContent=parsed.length;
 let rows=state.docs.map(doc=>{
  if(doc.status==='error')return '<tr><td><strong>'+renderEsc(doc.name)+'</strong></td><td>Parser failed</td><td><span class="flag critical">UPLOAD FAILED</span></td><td>'+renderEsc(doc.error||'Unknown error')+'</td><td><button type="button" class="btn light" data-routing-go="exceptions">Inspect</button></td></tr>';
  if(doc.status!=='parsed')return '<tr><td>'+renderEsc(doc.name)+'</td><td>Processing</td><td>Pending</td><td>—</td><td>—</td></tr>';
  const info=routeInfo(doc,m);
  let infoText=Object.entries(info.counts).filter(([k,v])=>v).map(([k,v])=>k.replace(/([A-Z])/g,' $1')+': '+v).join(' · ');
  let evidence=[...(doc.lines||[])].filter(x=>x.trim()).slice(0,22).join('\n').slice(0,3000);
  let chosen=Object.entries(m.sources).filter(([k,src])=>src.source===doc.name).map(([k])=>fields[k]?.label||k);
  let secondary=doc.fields?.length?' · '+doc.fields.length+' candidate values':'';
  return '<tr><td><strong>'+renderEsc(doc.name)+'</strong><span class="source">'+renderEsc(doc.kind)+secondary+'</span></td>'+
   '<td>'+info.routes.map(v=>'<button type="button" class="route-chip" data-routing-go="'+renderEsc(v)+'">'+renderEsc(routeLabels[v])+'</button>').join('')+'</td>'+
   '<td><span class="flag '+routeBadge(info)+'">'+renderEsc(info.status)+'</span></td>'+
   '<td><div>'+renderEsc(info.explanation)+'</div><span class="source">'+renderEsc(infoText||'No structured numeric data posted')+'</span>'+
   (chosen.length?'<span class="source">Model inputs: '+renderEsc(chosen.join(', '))+'</span>':'')+
   '<details class="source-detail"><summary>Inspect extracted document text</summary><pre class="detail">'+renderEsc(evidence)+'</pre></details></td>'+
   '<td><button type="button" class="btn light" data-routing-go="'+renderEsc(info.routes[0]||'exceptions')+'">Review →</button></td></tr>';
 });
 $('routing-table').innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>Uploaded source</th><th>Module destinations</th><th>Processing status</th><th>Evidence & controls</th><th>Open review</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 wireRouteButtons($('routing-table'));
 const unresolved=parsed.filter(d=>['REVIEW ONLY','EXCLUDED / REVIEW','DUPLICATE FORMAT'].includes(routeInfo(d,m).status));
 $('routing-note').textContent=parsed.length+' parsed files are assigned to review destinations. '+unresolved.length+' are review-only, excluded or alternate-format copies; no legal, loan, permit or payment approval is inferred.';
}
function wireRouteButtons(el){
 el.querySelectorAll('[data-routing-go]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.routingGo)));
}
function moduleEvidence(m,module){
 const matches=m.docs.filter(d=>routeInfo(d,m).routes.includes(module));
 const body=matches.map(d=>{
  let r=routeInfo(d,m),x=(d.lines||[]).filter(Boolean).slice(0,7).join('\n').slice(0,1100);
  return '<article class="evidence-item"><div><strong>'+renderEsc(d.name)+'</strong><div class="source">'+renderEsc(d.kind)+'</div></div><span class="flag '+routeBadge(r)+'">'+renderEsc(r.status)+'</span><p>'+renderEsc(r.explanation)+'</p><details><summary>See source excerpt</summary><pre class="detail">'+renderEsc(x)+'</pre></details></article>';
 }).join('');
 return '<article class="panel module-evidence"><div class="panel-header"><div><h2>Source documents assigned for '+renderEsc(routeLabels[module]||module)+' review</h2><p>Routing is visible for every uploaded file; assigned evidence is not an approved transaction.</p></div><span class="pill">'+matches.length+' FILES</span></div>'+
 (body||'<div class="empty-small">No documents have been assigned to this module yet.</div>')+
 '<div class="actions-bar"><button class="btn light" data-routing-go="routing">View all document destinations →</button></div></article>';
}
function renderModuleEvidence(m){
 for(const id of ['overview','budget','capital','cashflow','sellout','diligence','exceptions']){
  const target=$('evidence-'+id);
  if(target){target.innerHTML=m.docs.length?moduleEvidence(m,id):'';wireRouteButtons(target)}
 }
}

function tabular(doc){
 const s=doc.sheets||{},capital=getRow(s,[/capital.stack/i]),draws=getRow(s,[/monthly.draw/i,/construction.schedule/i,/draw.plan/i]),sell=getRow(s,[/unit.sellout/i]),permit=getRow(s,[/permit.gates/i]),risk=getRow(s,[/risk.register/i]),commit=getRow(s,[/commitment/i]);
 doc.capital={};for(const row of capital.slice(1)){const label=String(row[0]||'').toLowerCase().trim(),n=nval(row[1]);if(n!==null&&label)doc.capital[label]=n}
 doc.draws=[];for(const row of draws.slice(1)){const date=String(row[0]||'');if(!/^\d{4}[-/]\d\d$/.test(date))continue;doc.draws.push({month:date,cost:rowNum(row,1)||0,loan:rowNum(row,2)||0,interest:rowNum(row,3),sales:rowNum(row,4)||0})}
 doc.sellout=[];for(const row of sell.slice(1)){if(!/^CBR-|^[A-Za-z]{2,7}-\d+/.test(String(row[0]||'')))continue;doc.sellout.push({id:String(row[0]),type:String(row[1]||''),price:rowNum(row,2),closing:String(row[3]||''),status:String(row[4]||'')})}
 doc.permits=permit.slice(1).filter(r=>r[0]).map(r=>({name:String(r[0]),due:String(r[1]||''),status:String(r[2]||''),impact:String(r[5]||'')})).slice(0,200);
 doc.risks=risk.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),name:String(r[1]||''),severity:String(r[2]||''),status:String(r[3]||''),impact:String(r[5]||'')})).slice(0,200);
 doc.commitments=commit.slice(1).filter(r=>r[0]).map(r=>({code:String(r[0]),budget:rowNum(r,1),committed:rowNum(r,2),invoiced:rowNum(r,3),remaining:rowNum(r,4)})).slice(0,200);
 const sched=getRow(s,[/^MILESTONES$/i,/activity.schedule/i,/activity.timeline/i,/construction.schedule/i,/development.timeline/i,/schedule/i]);
 doc.scheduleActivities=sched.slice(1).filter(r=>r[0]&&/^\d{4}-\d\d/.test(String(r[1]||''))&&/^\d{4}-\d\d/.test(String(r[2]||''))).map(r=>({task:String(r[0]),start:String(r[1]),end:String(r[2]),workstream:String(r[3]||''),amount:rowNum(r,4),status:String(r[5]||'')})).slice(0,150);
 doc.invoiceDisputes=[];
 const inv=getRow(s,[/invoice/i,/dispute/i,/accounts.payable/i,/(?:^CSV$|^Sheet1$)/i]);
 if(inv.length && doc.kind==='CONSTRUCTION BILLING')doc.invoiceDisputes=inv.slice(1).filter(r=>r[0]&&r[2]).map(r=>({id:String(r[0]),trade:String(r[1]||''),vendor:String(r[2]||''),invoice:rowNum(r,3),po:rowNum(r,4),approval:String(r[5]||''),status:String(r[6]||'')})).slice(0,150);

}
function labelAmount(text,labels){for(const label of labels){let line=text.split(/\r?\n/).find(s=>new RegExp('^\\s*'+label+'\\s*:', 'i').test(s));if(line){const m=line.match(/\$\s*([\d,]+(?:\.\d+)?)/)||line.match(/:\s*([\d,]+(?:\.\d+)?)/);if(m)return nval(m[1])}}
 return null}
function additionalFacts(doc){const txt=doc.lines.join('\n');doc.change=null;doc.payment=null;doc.loanTerms=null;
 if(doc.kind==='APPROVED CHANGE ORDER'||doc.kind==='PENDING / UNVERIFIED CHANGE'){
  doc.change={status:doc.kind==='APPROVED CHANGE ORDER'?'APPROVED':'PENDING',cost:labelAmount(txt,['Incremental Hard Cost']),contractAddition:labelAmount(txt,['Requested Contract Addition']),code:txt.match(/\bCO-\d+\b/i)?.[0]||null};
 }
 if(doc.kind==='CONSTRUCTION BILLING'){
  const find=(labels)=>labelAmount(txt,labels);
  doc.payment={request:find(['Current Payment Request','Current payment request']),retainage:find(['Retainage']),completed:find(['Total Completed and Stored to Date','Work completed plus stored']),prior:find(['Less Prior Certified Payments','Prior certified']),net:find(['Net Earned to Date','Net earned']),label:doc.name};
  if(doc.payment.request===null){const one=txt.match(/current\s+(?:payment\s+)?request\s*[:\n\s]*\$\s*([\d,]+)/i);if(one)doc.payment.request=nval(one[1])}
 }
 if(doc.kind==='LENDER TERMS'){
  const rate=txt.match(/interest rate[^\n]*?([\d.]+)\s*%/i),ltc=txt.match(/(?:maximum loan|loan to cost|loan-to-cost)[^\n]*?([\d.]+)\s*%/i);
  doc.loanTerms={rate:rate?Number(rate[1])/100:null,ltc:ltc?Number(ltc[1])/100:null,term:txt.match(/loan tenor[^\n]*?(\d+)\s*months?/i)?.[1]||null};
 }
}
async function parseDocument(doc,bytes){const ext=doc.name.split('.').pop().toLowerCase();let data;
 if(ext==='pdf')data=await parsePDF(bytes);
 else if(['xlsx','xls','xlsm'].includes(ext))data=await parseExcel(bytes);
 else if(ext==='docx')data=await parseDOCX(bytes);
 else if(['csv','txt','json'].includes(ext))data=fromPlain(doc.name,bytes);
 else throw Error('Unsupported document type');
 doc.lines=data.lines||[];doc.sheets=data.sheets||{};doc.pages=data.pages||null;
 if(!doc.lines.length&&!Object.keys(doc.sheets).length)throw Error('No readable content available.');
 doc.kind=classify(doc.name,doc.lines.join('\n'),doc.sheets);
 fieldExtract(doc);tabular(doc);additionalFacts(doc);doc.risksFound=docRisks(doc);
 doc.status='parsed';
}

function derive(){
 const docs=state.docs.filter(d=>d.status==='parsed'), candidates={},values={},sources={},conflicts=[],issues=[];
 for(const doc of docs)for(const f of doc.fields||[])(candidates[f.key]??=[]).push({...f,id:doc.id,kind:doc.kind});
 for(const [key,arr] of Object.entries(candidates)){
  const usable=arr.filter(f=>f.score>0).sort((a,b)=>b.score-a.score);
  if(usable.length){values[key]=usable[0].value;sources[key]=usable[0];}
  const variants=[...new Set(arr.map(f=>String(f.value)))];
  if(variants.length>1){
   const rejected=arr.some(f=>f.score<0);
   conflicts.push({key,values:arr.slice(0,12),rejected,chosen:usable[0]||null});
   issues.push({level:'high',title:'Conflicting '+(fields[key]?.label||key)+' figures',
    detail:'Different source documents propose '+variants.slice(0,5).join(' vs ')+'. '+(rejected?'Unapproved or unrelated documents have been excluded from the model.':'The highest-priority structured source is provisional; review is required.'),
    source:arr.map(f=>f.source).slice(0,4).join(', ')});
  }
 }
 const present=keys=>keys.every(k=>typeof values[k]==='number');
 const cost=present(budgetKeys)?budgetKeys.reduce((a,k)=>a+values[k],0):null;
 const gross=present(['condosales','retailsales'])?values.condosales+values.retailsales:null;
 const net=gross!==null&&typeof values.salesexpenses==='number'?gross-values.salesexpenses:null;
 const profit=net!==null&&cost!==null?net-cost:null;
 const canonicalCap=docs.filter(d=>Object.keys(d.capital||{}).length).sort((a,b)=>b.fields.length-a.fields.length)[0];
 const canonicalDraw=docs.filter(d=>(d.draws||[]).length).sort((a,b)=>b.draws.length-a.draws.length)[0];
 const canonicalSell=docs.filter(d=>(d.sellout||[]).length).sort((a,b)=>b.sellout.length-a.sellout.length)[0];
 const scheduleActivities=docs.flatMap(d=>(d.scheduleActivities||[]).map(x=>({...x,source:d.name})));
 const invoiceDisputes=docs.flatMap(d=>(d.invoiceDisputes||[]).map(x=>({...x,source:d.name})));
 const permits=docs.flatMap(d=>(d.permits||[]).map(x=>({...x,source:d.name})));
 const risks=docs.flatMap(d=>(d.risks||[]).map(x=>({...x,source:d.name})));
 const commitments=docs.flatMap(d=>(d.commitments||[]).map(x=>({...x,source:d.name})));
 const changes=Array.from(docs.filter(d=>d.change).map(d=>({...d.change,source:d.name})).reduce((by,c)=>{const key=c.code||c.source.replace(/\.(docx|pdf)$/i,'');const old=by.get(key);if(!old||(/\.pdf$/i.test(c.source)&&!/\.pdf$/i.test(old.source)))by.set(key,c);return by},new Map()).values());
 const payments=Array.from(docs.filter(d=>d.payment).map(d=>({...d.payment,source:d.name})).reduce((by,p)=>{const key=p.source.replace(/\.(docx|pdf)$/i,'');if(!by.has(key)||/\.pdf$/i.test(p.source))by.set(key,p);return by},new Map()).values());
 const lender=Array.from(docs.filter(d=>d.loanTerms).map(d=>({...d.loanTerms,source:d.name})).reduce((by,l)=>{const key=l.source.replace(/\.(docx|pdf)$/i,'');if(!by.has(key)||/\.pdf$/i.test(l.source))by.set(key,l);return by},new Map()).values());
 const draws=canonicalDraw?.draws||[],sellout=canonicalSell?.sellout||[],cap=canonicalCap?.capital||{};
 const approvedChanges=changes.filter(c=>c.status==='APPROVED');
 const pendingChanges=changes.filter(c=>c.status!=='APPROVED');
 const approvedDelta=approvedChanges.reduce((n,c)=>n+(c.cost||0),0);
 if(approvedChanges.length)issues.push({level:'high',title:'Approved change orders require budget reconciliation',detail:money(approvedDelta)+' in incremental hard costs found. This is held as a separate scenario until verified as not already included in the base budget.',source:approvedChanges.map(c=>c.source).join(', ')});
 if(pendingChanges.length)issues.push({level:'high',title:'Unapproved construction changes excluded',detail:pendingChanges.length+' pending or unverified change order(s) were identified; no unapproved cost is included.',source:pendingChanges.map(c=>c.source).join(', ')});
 if(payments.length)issues.push({level:'high',title:'Construction pay applications require certification',detail:payments.length+' payment-related document(s) parsed. Differences in contract totals and completion bases must be reconciled before booking.',source:payments.map(p=>p.source).join(', ')});
 if(lender.length)issues.push({level:'high',title:'Lender terms are indicative only',detail:'The model has not approved debt commitment, draws, interest capitalization, or loan closing costs. Project profit is before financing.',source:lender.map(p=>p.source).join(', ')});
 if(draws.length){
  const scheduled=draws.reduce((n,x)=>n+x.cost,0);
  if(cost!==null&&Math.abs(scheduled-cost)>1)issues.push({level:'high',title:'Monthly construction schedule does not reconcile to development uses',detail:'Scheduled '+money(scheduled)+' versus base cost '+money(cost)+'.',source:canonicalDraw.name});
  if(draws.length!==36)issues.push({level:'medium',title:'Construction forecast period differs from 36 months',detail:draws.length+' forecast periods provided.',source:canonicalDraw.name});
 }
 if(sellout.length){
  const sum=sellout.reduce((n,u)=>n+(u.price||0),0);
  if(typeof values.units==='number'&&values.units!==sellout.length)issues.push({level:'critical',title:'Condominium count mismatch',detail:'Model '+values.units+' versus unit schedule '+sellout.length+'.',source:canonicalSell.name});
  if(typeof values.condosales==='number'&&Math.abs(values.condosales-sum)>1)issues.push({level:'critical',title:'Condominium sellout discrepancy',detail:'Model '+money(values.condosales)+' versus unit-price schedule '+money(sum)+'.',source:canonicalSell.name});
 }
 const rental=docs.filter(d=>d.kind==='RENT ROLL / SEPARATE USE');
 if(rental.length)issues.push({level:'medium',title:'Separate rental data segregated from condo deal',detail:'Rental rent roll was not used to change condominium units or selling prices.',source:rental.map(d=>d.name).join(', ')});
 const unapproved=docs.filter(d=>d.kind==='REVISED / UNAPPROVED');
 if(unapproved.length)issues.push({level:'high',title:'Superseded budget revision held',detail:'Budget revisions marked unapproved or superseded cannot overwrite the controlled base.',source:unapproved.map(d=>d.name).join(', ')});
 const failed=state.docs.filter(d=>d.status==='error');
 // Technical parser failures are operational errors, not financial review exceptions.
 const errors=failed.map(d=>({title:'Upload processing failed: '+d.name,detail:d.error||'Unknown extraction error.',source:d.name}));
 const missing=Object.keys(fields).filter(k=>values[k]===undefined);
 if(docs.length&&missing.length)issues.push({level:'medium',title:'Incomplete master project fields',detail:missing.length+' fields are not supported by uploaded recognized documents: '+missing.slice(0,8).map(k=>fields[k].label).join(', ')+(missing.length>8?'…':''),source:'Master Entry'});
 if(docs.length&&!draws.length)issues.push({level:'medium',title:'Monthly construction forecast not available',detail:'Upload a dated construction schedule or integrated financing workbook. No timing is invented.',source:'Construction schedule'});
 if(docs.length&&!sellout.length)issues.push({level:'medium',title:'Unit sellout schedule not available',detail:'Upload a unit-by-unit pricing schedule. The platform will not infer unit values from gross sales alone.',source:'Sales schedule'});
 if(risks.length){const critical=risks.filter(r=>/critical/i.test(r.severity)&&!/^closed|resolved|approved$/i.test(r.status));if(critical.length)issues.push({level:'high',title:critical.length+' critical diligence items remain open',detail:'Permits, lender conditions and construction approvals remain unverified.',source:critical.slice(0,3).map(r=>r.id).join(', ')})}
 const duplicates=docs.filter(d=>docs.some(other=>other.id!==d.id&&other.name.replace(/\.(docx|pdf)$/i,'')===d.name.replace(/\.(docx|pdf)$/i,'')&&/\.docx$/i.test(d.name)&&/\.pdf$/i.test(other.name)));
 const m={docs,candidates,values,sources,conflicts,issues,errors,duplicates,missing,cost,gross,net,profit,cap,draws,sellout,permits,risks,commitments,scheduleActivities,invoiceDisputes,changes,payments,lender,approvedDelta,approvedChanges,pendingChanges};
 state.model=m;return m;
}
function viewEmpty(message){return '<div class="empty-view"><div style="font-size:36px;color:#4191c0">◇</div><h2>Nothing to calculate yet</h2><p>'+renderEsc(message||'Upload source deal documents to begin populating this view.')+'</p><button class="btn primary" data-go="documents">Upload documents →</button></div>'}
function financialRow(label,value,total){return '<div class="financial-row'+(total?' total':'')+'"><span>'+renderEsc(label)+'</span><strong>'+money(value)+'</strong></div>'}
function bar(label,value,max,extra,gold){if(!Number.isFinite(value))return '';return '<div><div class="bar-heading"><span>'+renderEsc(label)+'</span><strong>'+money(value)+(extra?' · '+renderEsc(extra):'')+'</strong></div><div class="bar-track"><div class="bar-fill'+(gold?' gold':'')+'" style="width:'+Math.max(1,Math.min(100,100*value/Math.max(max,1))).toFixed(1)+'%"></div></div></div>'}
function chart(draws){if(!draws.length)return '<div class="empty-small">No dated schedule uploaded.</div>';
 const w=650,h=228,top=17,left=34,bottom=186,xspan=w-left-12,max=Math.max(1,...draws.map(x=>Math.max(x.cost,x.sales,x.loan)));
 let rect='',labels='',grid='';for(let i=0;i<4;i++){let y=top+(bottom-top)*i/3;grid+='<line x1="'+left+'" x2="'+(w-8)+'" y1="'+y+'" y2="'+y+'" stroke="#e2eaf0" />';grid+='<text x="2" y="'+(y+3)+'" fill="#7890a3" font-size="9">'+renderEsc(compact(max*(1-i/3)))+'</text>'}
 const group=xspan/draws.length,bw=Math.max(2,Math.min(11,group/3.9));
 draws.forEach((d,i)=>{let x=left+i*group+group*.1;let vals=[d.cost,d.loan,d.sales],colors=['#287caf','#bfa06e','#1b987b'];vals.forEach((v,j)=>{const bh=(bottom-top)*Math.max(0,v)/max;rect+='<rect x="'+(x+j*bw)+'" y="'+(bottom-bh)+'" width="'+Math.max(1,bw-1)+'" height="'+bh+'" fill="'+colors[j]+'"><title>'+renderEsc(d.month+': '+['Cost','Loan draw','Sales'][j]+' '+money(v))+'</title></rect>'});if(i%6===0||i===draws.length-1)labels+='<text x="'+(x+2)+'" y="204" font-size="9" fill="#7792a5">'+renderEsc(d.month.slice(2))+'</text>'});
 return '<div class="chart-legend"><span><i style="background:#287caf"></i>Development spend</span><span><i style="background:#bfa06e"></i>Illustrative debt</span><span><i style="background:#1b987b"></i>Sale closings</span></div><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Monthly costs, loan draws and sales cashflow">'+grid+rect+labels+'</svg>'}
function renderOverview(m){const started=m.docs.length>0;$('overview-empty').hidden=started;$('overview-live').hidden=!started;if(!started)return;
 $('kpi-cost').textContent=compact(m.cost);$('kpi-gross').textContent=compact(m.gross);$('kpi-net').textContent=compact(m.net);$('kpi-profit').textContent=compact(m.profit);
 $('model-confidence').textContent=m.missing.length||m.issues.length?'PROVISIONAL · REVIEW REQUIRED':'DOCUMENT-DERIVED · PROVISIONAL';
 $('project-subtitle').textContent=[m.values.name,m.values.city,m.values.state].filter(Boolean).join(' · ')||'Project details pending';
 $('financial-bridge').innerHTML=financialRow('Land acquisition',m.values.land)+financialRow('Residential construction',m.values.residential)+financialRow('Retail construction',m.values.retailcost)+financialRow('Parking construction',m.values.parkingcost)+financialRow('Indirect development costs',m.values.indirect)+financialRow('Total pre-finance uses',m.cost,true)+financialRow('Condominium sale proceeds',m.values.condosales)+financialRow('Retail sale proceeds',m.values.retailsales)+financialRow('Less selling expenses',m.values.salesexpenses)+financialRow('Net proceeds',m.net,true)+financialRow('Pre-financing profit',m.profit,true);
 $('model-gaps').innerHTML='Pre-financing model only. Approved change order scenario '+money(m.approvedDelta)+' remains separate until reconciled. Construction interest, lender fees, taxes, true loan draw mechanics and investment IRR are not calculated or certified here.';
 $('health-files').textContent=m.docs.length;$('health-fields').textContent=Object.keys(m.values).length;$('health-issues').textContent=m.issues.length+' reviews · '+m.errors.length+' failures';
 $('health-list').innerHTML=m.issues.slice(0,6).map(x=>'<div class="risk-item"><i class="dot"></i><span>'+renderEsc(x.title)+'</span></div>').join('')||'<div class="risk-item">No flagged issues from available input.</div>';
 const costs=budgetKeys.map(k=>({label:fields[k].label,value:m.values[k]}));$('overview-cost-bars').innerHTML=costs.filter(x=>Number.isFinite(x.value)).map(x=>bar(x.label,x.value,m.cost||1,'',false)).join('')||viewEmpty('Upload a development budget.');
 $('overview-chart').innerHTML=chart(m.draws);
}
function renderDocList(m){const list=$('file-list');if(!state.docs.length){list.innerHTML='<div class="empty-small">No files yet. Upload your deal documents to populate the workspace.</div>'}else{
 list.innerHTML=state.docs.map(d=>'<div class="file-item"><div class="file-icon">▤</div><div class="file-info"><strong>'+renderEsc(d.name)+'</strong><small>'+(d.kind?renderEsc(d.kind)+' · ':'')+Math.round(d.size/1024)+' KB · '+(d.status==='parsed'?(d.fields?.length||d.draws?.length||d.sellout?.length?'<span style="color:#16795a">READ · FIELDS MAPPED</span>':'<span style="color:#196e91">READ · EVIDENCE ONLY</span>'):d.status==='error'?'<span style="color:#ac4540">UPLOAD FAILED</span>':'READING…')+(d.error?' · '+renderEsc(d.error):'')+'</small></div><button type="button" class="file-x" data-remove="'+d.id+'" title="Remove and recalculate" aria-label="Remove '+renderEsc(d.name)+'">×</button></div>').join('');
 list.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{const id=Number(btn.dataset.remove);state.docs=state.docs.filter(d=>d.id!==id);refresh()}));
 }
 $('files-count-label').textContent='('+state.docs.length+')';$('queued-count').textContent=state.docs.length+' FILES';$('side-files').textContent=state.docs.length;
 $('process-files').disabled=state.busy||!state.docs.length;$('clear-files').disabled=state.busy||!state.docs.length;
 $('processed-count').textContent=m.docs.length;
 $('failed-count').textContent=m.errors.length;
 $('duplicate-count').textContent=m.duplicates.length;
 $('found-fields').textContent=Object.values(m.candidates).reduce((n,a)=>n+a.length,0);
 $('confirmed-fields').textContent=Object.keys(m.values).length;
 $('flagged-fields').textContent=m.issues.length;
 let rows=[];for(const [k,def] of Object.entries(fields)){
  const chosen=m.sources[k],candidates=m.candidates[k]||[],conflict=m.conflicts.find(c=>c.key===k);
  if(!chosen&&!candidates.length)continue;
  const stat=!chosen?'EXCLUDED':conflict?'FINANCIAL REVIEW':'MODELED';
  rows.push('<tr><td><strong>'+renderEsc(def.label)+'</strong></td><td class="num">'+renderEsc(chosen?fieldDisplay(k,chosen.value):'—')+'</td><td>'+renderEsc(chosen?.source||'Not selected')+'<span class="source">'+renderEsc(chosen?.location||'')+'</span></td><td><span class="flag '+(stat==='MODELED'?'green':stat==='EXCLUDED'?'critical':'')+'">'+stat+'</span></td><td>'+renderEsc(conflict?conflict.values.map(v=>String(v.value)+' ['+v.source+']').join(' vs '):chosen?.evidence||'')+'</td></tr>');
 }
 $('assumptions-table').innerHTML=rows.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Financial field</th><th class="num">Model value</th><th>Primary source</th><th>Control</th><th>Evidence / Exceptions</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':viewEmpty('Extract the Master Underwriting PDF or the integrated financial workbook.');
 $('process-note').textContent=state.busy?'Extracting and recalculating…':state.docs.length+' document(s) in workspace · No server uploads';
}
function renderBudget(m){if(!budgetKeys.some(k=>m.values[k]!==undefined)){$('budget-content').innerHTML=viewEmpty('Upload a structured development budget.');return}
 const costs=budgetKeys.map(k=>({key:k,name:fields[k].label,value:m.values[k]}));
 let body=costs.map(c=>'<tr><td><strong>'+renderEsc(c.name)+'</strong><span class="source">'+renderEsc(m.sources[c.key]?.source||'Not provided')+'</span></td><td class="num">'+money(c.value)+'</td><td class="num">'+(m.cost&&Number.isFinite(c.value)?pct(c.value/m.cost):'—')+'</td><td><span class="flag '+(m.sources[c.key]?'green':'')+'">'+(m.sources[c.key]?'Parsed':'Missing')+'</span></td></tr>').join('');
 const scenario=m.cost!==null&&m.approvedDelta?m.cost+m.approvedDelta:null;
 $('budget-content').innerHTML='<div class="metrics"><article class="metric"><span>Base development uses</span><strong>'+compact(m.cost)+'</strong><small>Document-sourced total</small></article><article class="metric"><span>Approved-CO cost scenario</span><strong>'+compact(m.approvedDelta)+'</strong><small>Held until base-budget reconciliation</small></article><article class="metric"><span>Illustrative cost including CO</span><strong>'+compact(scenario)+'</strong><small>Not a posted budget revision</small></article><article class="metric accent"><span>Remaining profit in scenario</span><strong>'+compact(m.net!==null&&scenario!==null?m.net-scenario:null)+'</strong><small>Pre-finance, conditional scenario</small></article></div><div class="grid twothird"><div class="panel"><div class="panel-header"><div><h2>Source-backed development budget</h2><p>Cost categories and original document references</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Cost category</th><th class="num">Amount</th><th class="num">% of cost</th><th>Source</th></tr></thead><tbody>'+body+'<tr><td><strong>BASE TOTAL</strong></td><td class="num"><strong>'+money(m.cost)+'</strong></td><td class="num">100%</td><td>Pre-finance</td></tr></tbody></table></div></div><div class="panel"><div class="panel-header"><div><h2>Cost composition</h2><p>Category-weighted spending</p></div></div><div class="bars">'+costs.filter(c=>Number.isFinite(c.value)).map(c=>bar(c.name,c.value,m.cost||1,'',false)).join('')+'</div><div class="warn" style="margin-top:23px">Approved change-order cost may already be included in baseline contracts. The scenario is not posted without explicit review.</div></div></div>';
}

function renderCapital(m){if(!m.docs.length){$('capital-content').innerHTML=viewEmpty('Upload lender, contractor and development finance source documents.');return}
 const c=m.cap,hard=Number.isFinite(m.values.residential)&&Number.isFinite(m.values.retailcost)&&Number.isFinite(m.values.parkingcost)?m.values.residential+m.values.retailcost+m.values.parkingcost:null;
 const loan=c['loan funding']??null,equity=c['required equity before finance']??null,rate=c['loan rate']??m.lender[0]?.rate??null,ltc=c['construction loan %']??m.lender[0]?.ltc??null;
 const commitRows=m.commitments.map(x=>'<tr><td><strong>'+renderEsc(x.code)+'</strong></td><td class="num">'+money(x.budget)+'</td><td class="num">'+money(x.committed)+'</td><td class="num">'+money(x.invoiced)+'</td><td class="num">'+money(x.remaining)+'</td><td>'+renderEsc(x.source)+'</td></tr>').join('');
 const changeRows=m.changes.map(x=>'<tr><td><strong>'+renderEsc(x.code||'Unnumbered CO')+'</strong></td><td><span class="flag '+(x.status==='APPROVED'?'green':'critical')+'">'+renderEsc(x.status)+'</span></td><td class="num">'+money(x.cost)+'</td><td class="num">'+money(x.contractAddition)+'</td><td>'+renderEsc(x.source)+'</td></tr>').join('');
 const payRows=m.payments.map(x=>'<tr><td><strong>'+renderEsc(x.source)+'</strong></td><td class="num">'+money(x.completed)+'</td><td class="num">'+money(x.retainage)+'</td><td class="num">'+money(x.prior)+'</td><td class="num">'+money(x.request)+'</td><td><span class="flag">UNCERTIFIED</span></td></tr>').join('');
 $('capital-content').innerHTML='<div class="metrics"><article class="metric"><span>Eligible hard costs</span><strong>'+compact(hard)+'</strong><small>Construction uses before financing</small></article><article class="metric"><span>Indicative loan funding</span><strong>'+compact(loan)+'</strong><small>No executed commitment</small></article><article class="metric"><span>Indicative sponsor equity</span><strong>'+compact(equity)+'</strong><small>Before interest and fees</small></article><article class="metric accent"><span>Indicative borrowing rate</span><strong>'+pct(rate)+'</strong><small>Unexecuted terms, '+pct(ltc)+' LTC assumption</small></article></div>'+
 '<div class="warn">Debt figures are informational assumptions, not funded amounts. No bank approval, interest calculation, construction draw entitlement, or accounting journal has been created.</div>'+
 '<div class="grid equal"><article class="panel"><div class="panel-header"><div><h2>Change-order cost controls</h2><p>Approved costs shown separately from pending scope</p></div></div>'+(changeRows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>CO</th><th>Status</th><th class="num">Cost</th><th class="num">Contract addition</th><th>Source</th></tr></thead><tbody>'+changeRows+'</tbody></table></div>':'<div class="empty-small">No change orders parsed yet.</div>')+'</article>'+
 '<article class="panel"><div class="panel-header"><div><h2>Contractor billing</h2><p>Requested applications—not certified payments</p></div></div>'+(payRows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Source</th><th class="num">Completed</th><th class="num">Retainage</th><th class="num">Prior certified</th><th class="num">Request</th><th>Review</th></tr></thead><tbody>'+payRows+'</tbody></table></div>':'<div class="empty-small">No pay applications parsed yet.</div>')+'</article></div>'+
 '<article class="panel"><div class="panel-header"><div><h2>Trade commitments and cost-to-complete</h2><p>Workbook-supplied cost codes and invoice balances</p></div></div>'+(commitRows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Trade</th><th class="num">Budget</th><th class="num">Committed</th><th class="num">Invoiced</th><th class="num">Remaining forecast</th><th>Source</th></tr></thead><tbody>'+commitRows+'</tbody></table></div>':'<div class="empty-small">Upload a commitments workbook with cost codes and amounts.</div>')+'</article>'+renderInvoiceReview(m);
}
function renderInvoiceReview(m){
 if(!m.invoiceDisputes.length)return '';
 let rows=m.invoiceDisputes.map(x=>'<tr><td><strong>'+renderEsc(x.id)+'</strong></td><td>'+renderEsc(x.vendor)+'</td><td>'+renderEsc(x.trade)+'</td><td class="num">'+money(x.invoice)+'</td><td class="num">'+money(x.po)+'</td><td>'+renderEsc(x.approval||x.status||'REVIEW')+'</td><td>'+renderEsc(x.source)+'</td></tr>').join('');
 return '<article class="panel" style="margin-top:17px"><div class="panel-header"><div><h2>Invoice exception & approval review</h2><p>Review invoiced values against purchase order values; no payment or payable is created.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Invoice</th><th>Vendor</th><th>Trade</th><th class="num">Invoiced</th><th class="num">PO</th><th>Approval / Status</th><th>Source</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>';
}
function renderCashflow(m){if(!m.draws.length&&!m.scheduleActivities.length){$('cashflow-content').innerHTML=viewEmpty('Upload a workbook containing dated monthly draws or a construction spending schedule.');return}
 if(!m.draws.length&&m.scheduleActivities.length){
 $('cashflow-content').innerHTML=renderScheduleActivities(m)+'<div class="note">No monthly cash-flow values provided; activities alone do not establish actual spending or financing draw amounts.</div>';return;
 }
 const d=m.draws,spend=d.reduce((a,x)=>a+x.cost,0),loan=d.reduce((a,x)=>a+x.loan,0),sales=d.reduce((a,x)=>a+x.sales,0);
 const rows=d.map((x,i)=>'<tr><td><strong>'+renderEsc(x.month)+'</strong></td><td class="num">'+money(x.cost)+'</td><td class="num">'+money(x.loan)+'</td><td class="num">'+money(x.interest)+'</td><td class="num">'+money(x.sales)+'</td><td class="num">'+money(x.sales+x.loan-x.cost)+'</td></tr>').join('');
 $('cashflow-content').innerHTML='<div class="metrics"><article class="metric"><span>Scheduled base spending</span><strong>'+compact(spend)+'</strong><small>'+d.length+' forecast periods</small></article><article class="metric"><span>Illustrative total loan draws</span><strong>'+compact(loan)+'</strong><small>Subject to lender eligibility</small></article><article class="metric"><span>Scheduled closing receipts</span><strong>'+compact(sales)+'</strong><small>Sales assumptions, not executed contracts</small></article><article class="metric accent"><span>Budget vs scheduled spend</span><strong>'+compact(m.cost!==null?spend-m.cost:null)+'</strong><small>Should equal zero</small></article></div>'+
 '<article class="panel"><div class="panel-header"><div><h2>Development cash flow · '+d.length+' months</h2><p>Source-supplied values; financing interest may be incomplete</p></div></div>'+chart(d)+'</article>'+
 '<article class="panel" style="margin-top:17px"><div class="panel-header"><div><h2>Monthly cash schedule</h2><p>Positive monthly net is illustrative and excludes undisclosed financing fees</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Period</th><th class="num">Scheduled costs</th><th class="num">Loan draws</th><th class="num">Interest estimate</th><th class="num">Closing receipts</th><th class="num">Net pre-interest</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>'+renderScheduleActivities(m);
}
function renderScheduleActivities(m){
 if(!m.scheduleActivities.length)return '';
 const rows=m.scheduleActivities.map(a=>'<tr><td><strong>'+renderEsc(a.task)+'</strong></td><td>'+renderEsc(a.start)+'</td><td>'+renderEsc(a.end)+'</td><td>'+renderEsc(a.workstream)+'</td><td class="num">'+money(a.amount)+'</td><td>'+renderEsc(a.status)+'</td><td>'+renderEsc(a.source)+'</td></tr>').join('');
 return '<article class="panel" style="margin-top:17px"><div class="panel-header"><div><h2>Construction activities requiring schedule review</h2><p>'+m.scheduleActivities.length+' dated source activities. These do not automatically replace the original 48-month illustrative development timetable.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Workstream</th><th class="num">Budget</th><th>Status</th><th>Source</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>';
}
function renderSellout(m){if(!m.sellout.length){$('sellout-content').innerHTML=viewEmpty('Upload the unit sellout workbook. Rental rent rolls are kept separate from condominium sale assumptions.');return}
 const units=m.sellout,unitTotal=units.reduce((a,x)=>a+(x.price||0),0),matched=Number.isFinite(m.values.condosales)?unitTotal-m.values.condosales:null;
 const rows=units.map(x=>'<tr><td><strong>'+renderEsc(x.id)+'</strong></td><td>'+renderEsc(x.type)+'</td><td class="num">'+money(x.price)+'</td><td>'+renderEsc(x.closing)+'</td><td>'+renderEsc(x.status)+'</td></tr>').join('');
 const bytype={};for(const u of units){const k=u.type||'Unspecified';let v=bytype[k]??(bytype[k]={count:0,sales:0});v.count++;v.sales+=u.price||0}
 $('sellout-content').innerHTML='<div class="metrics"><article class="metric"><span>Unit schedule count</span><strong>'+integer(units.length)+'</strong><small>Compared with '+integer(m.values.units)+' master units</small></article><article class="metric"><span>Unit schedule sellout</span><strong>'+compact(unitTotal)+'</strong><small>Sum of source row prices</small></article><article class="metric"><span>Master condo proceeds</span><strong>'+compact(m.values.condosales)+'</strong><small>Structured underwriting input</small></article><article class="metric accent"><span>Sellout difference</span><strong>'+compact(matched)+'</strong><small>Zero indicates price reconciliation</small></article></div>'+
 '<div class="grid equal"><article class="panel"><div class="panel-header"><div><h2>Unit mix by product</h2><p>Document-derived sales by floor-plan category</p></div></div><div class="bars">'+Object.entries(bytype).map(([k,v])=>bar(k,v.sales,unitTotal,v.count+' units')).join('')+'</div></article><article class="panel"><div class="panel-header"><div><h2>Sellout reconciliation</h2><p>Separately sourced master and unit detail</p></div></div>'+financialRow('Master condominium sales',m.values.condosales)+financialRow('Sum of unit prices',unitTotal)+financialRow('Difference',matched,true)+'<div class="helpbox">Expected closing dates represent modeled assumptions, not contracts, proceeds received, or recognized revenue.</div></article></div>'+
 '<article class="panel"><div class="panel-header"><div><h2>Individual condominium pricing</h2><p>'+units.length+' sale units · Source-based assumptions</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Unit</th><th>Type</th><th class="num">Target price</th><th>Projected close</th><th>Sales status</th></tr></thead><tbody>'+rows+'</tbody></table></div></article>';
}
function renderDiligence(m){if(!m.permits.length&&!m.risks.length){$('diligence-content').innerHTML=viewEmpty('Upload permit-gate, environmental, title and risk documents.');return}
 const critical=m.risks.filter(x=>/critical/i.test(x.severity)).length;
 const permitRows=m.permits.map(x=>'<tr><td><strong>'+renderEsc(x.name)+'</strong></td><td>'+renderEsc(x.due)+'</td><td><span class="flag">'+renderEsc(x.status)+'</span></td><td>'+renderEsc(x.impact)+'</td><td>'+renderEsc(x.source)+'</td></tr>').join('');
 const riskRows=m.risks.map(x=>'<tr><td>'+renderEsc(x.id)+'</td><td><strong>'+renderEsc(x.name)+'</strong></td><td><span class="flag '+(/critical/i.test(x.severity)?'critical':'')+'">'+renderEsc(x.severity)+'</span></td><td>'+renderEsc(x.status)+'</td><td>'+renderEsc(x.impact)+'</td></tr>').join('');
 $('diligence-content').innerHTML='<div class="metrics"><article class="metric"><span>Permit / diligence milestones</span><strong>'+integer(m.permits.length)+'</strong><small>Source evidence only</small></article><article class="metric"><span>Risk register entries</span><strong>'+integer(m.risks.length)+'</strong><small>Subject to diligence review</small></article><article class="metric"><span>Critical risk register items</span><strong>'+integer(critical)+'</strong><small>Not verified as resolved</small></article><article class="metric accent"><span>Approved or certified</span><strong>—</strong><small>Not inferred from uploaded documents</small></article></div>'+
 '<div class="warn">No zoning, permit, environmental, title or lender approval is inferred merely because a document has been uploaded.</div>'+
 '<div class="section-stack" style="margin-top:17px"><article class="panel"><div class="panel-header"><div><h2>Permit and project gates</h2><p>Required external validation</p></div></div>'+(permitRows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Milestone</th><th>Target</th><th>Status</th><th>Decision impact</th><th>Source</th></tr></thead><tbody>'+permitRows+'</tbody></table></div>':'<div class="empty-small">No permit table uploaded.</div>')+'</article>'+
 '<article class="panel"><div class="panel-header"><div><h2>Risk register</h2><p>Unresolved conditions, compliance, capital and constructability</p></div></div>'+(riskRows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Risk / Trigger</th><th>Severity</th><th>Status</th><th>Consequence</th></tr></thead><tbody>'+riskRows+'</tbody></table></div>':'<div class="empty-small">No risk register uploaded.</div>')+'</article></div>';
}
function renderExceptions(m){if(!m.docs.length&&!m.errors.length){$('exceptions-content').innerHTML=viewEmpty('Upload source documents; financial reviews and actual upload failures will appear in separate sections.');return}
 const critical=m.issues.filter(x=>x.level==='critical').length,high=m.issues.filter(x=>x.level==='high').length;
 const failureSection=m.errors.length?'<article class="panel" style="margin-bottom:17px;border-color:#e9b7b2"><div class="panel-header"><div><h2>Technical upload failures</h2><p>Files that could not be processed; separate from financial review requirements</p></div><span class="pill red">'+m.errors.length+' FAILED</span></div>'+m.errors.map(e=>'<div class="alert-card critical"><h3>Upload failed: '+renderEsc(e.source)+'</h3><p>'+renderEsc(e.detail)+'</p></div>').join('')+'</article>':'<div class="section-summary">No file-processing failures detected. Financial review items below are not upload errors.</div>';
 const rows=m.issues.map((x,i)=>'<article class="alert-card '+(x.level==='critical'?'critical':'')+'"><h3>⚑ '+renderEsc(x.title)+' <span class="flag '+(x.level==='critical'?'critical':'')+'">'+renderEsc(x.level.toUpperCase())+'</span></h3><p>'+renderEsc(x.detail)+'</p><small>Evidence: '+renderEsc(x.source)+'</small></article>').join('');
 const fileRisks=m.docs.flatMap(d=>(d.risksFound||[]).map(x=>({source:d.name,msg:x})));
 $('exceptions-content').innerHTML=failureSection+'<div class="metrics"><article class="metric"><span>Financial review items</span><strong>'+integer(m.issues.length)+'</strong><small>Requiring financial review</small></article><article class="metric"><span>Technical file failures</span><strong>'+integer(m.errors.length)+'</strong><small>Data and integrity issues</small></article><article class="metric"><span>High-priority risks</span><strong>'+integer(high)+'</strong><small>Financial or approval exposure</small></article><article class="metric accent"><span>Conflicting master inputs</span><strong>'+integer(m.conflicts.length)+'</strong><small>Includes excluded revisions</small></article></div>'+
 '<div class="grid twothird"><article class="panel"><div class="panel-header"><div><h2>Financial review required</h2><p>Controls are evidence-based, not AI-generated approvals</p></div></div>'+ (rows||'<div class="empty-small">No flags from processed source set. This does not guarantee absence of risk.</div>')+'</article>'+
 '<article class="panel"><div class="panel-header"><div><h2>Document-level review alerts</h2><p>Exceptions found in the source language or classification</p></div></div>'+(fileRisks.map(r=>'<div class="risk-item"><i class="dot"></i><div><strong>'+renderEsc(r.msg)+'</strong><div class="source">'+renderEsc(r.source)+'</div></div></div>').join('')||'<div class="empty-small">No document warnings detected.</div>')+'</article></div>';
}
function refresh(){
 const m=derive();renderOverview(m);renderDocList(m);renderBudget(m);renderCapital(m);renderCashflow(m);renderSellout(m);renderDiligence(m);renderExceptions(m);renderRouting(m);renderModuleEvidence(m);
 $('top-project').textContent=m.values.name|| (state.mode==='test'?'Fictional Development Test · Awaiting Documents':'New blank development project');
 $('status').textContent=state.busy?'PROCESSING':m.errors.length?m.errors.length+' FILE FAILURE(S)':m.docs.length?'MODEL POPULATED · REVIEW REQUIRED':'BLANK CANVAS';
 $('status').className='pill '+(m.errors.length?'red':m.docs.length?'orange':'');
 $('side-exceptions').textContent=m.issues.length+m.errors.length;$('btn-export').disabled=!m.docs.length;
 $('side-routing').textContent=m.docs.length;

 if(!state.busy&&window.parent&&window.parent!==window){
  const snapshot={values:m.values,sources:m.sources,cap:m.cap,draws:m.draws,documents:m.docs.length,logicalDocuments:new Set(m.docs.map(d=>d.name.replace(/^(\d+)_.*$/,'$1'))).size,routedFiles:m.docs.filter(d=>routeInfo(d,m).routes.length).length,issues:m.issues.length,finance:{cost:m.cost,gross:m.gross,net:m.net,profit:m.profit}};
  window.parent.postMessage({type:'PFI_WORKSPACE_SNAPSHOT',snapshot},location.origin);
 }

}
function showView(name){state.view=name;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+name));document.querySelectorAll('#nav button').forEach(el=>el.classList.toggle('selected',el.dataset.view===name));window.scrollTo({top:0,behavior:'instant'})}
function mode(m){state.mode=m;$('mode-blank').classList.toggle('active',m==='blank');$('mode-test').classList.toggle('active',m==='test');$('mode-note').textContent=m==='test'?'Cypress Bay · No preloaded data · Upload the fictional ZIP':'Blank workspace · No preloaded data';refresh()}
const supported=new Set(['pdf','xlsx','xls','xlsm','docx','csv','txt','json']);
function fileSizeOk(n){return n<=12*1024*1024}
async function addDoc(name,bytes,origin){
 const ext=name.split('.').pop().toLowerCase();if(!supported.has(ext))return null;
 const clean=name.replace(/^.*[\/\\]/,'');
 if(!fileSizeOk(bytes.byteLength))return {status:'skipped',message:clean+' exceeds 12MB browser test limit'};
 if(state.docs.length>=120)return {status:'skipped',message:'120-document test limit reached'};
 // Same name + byte length is assumed duplicate in this controlled QA session.
 if(state.docs.some(x=>x.name===clean&&x.size===bytes.byteLength))return {status:'duplicate'};
 const doc={id:state.next++,name:clean,origin:origin||'user upload',size:bytes.byteLength,bytes,status:'reading',kind:'Reading…',fields:[],lines:[],sheets:{}};
 state.docs.push(doc);refresh();
 try{await parseDocument(doc,bytes);if(!state.docs.includes(doc))return null;}
 catch(err){doc.status='error';doc.error=String(err?.message||err).slice(0,240);doc.kind='PARSER ERROR'}
 refresh();return {status:doc.status};
}
async function ingestFiles(input){
 if(state.busy)return;state.busy=true;refresh();
 let errors=[];
 try{
 for(const file of Array.from(input)){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='zip'){
   try{
    if(file.size>35*1024*1024)throw Error('ZIP exceeds 35MB QA limit');
    if(!window.JSZip)throw Error('ZIP reader did not load');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const valid=Object.values(zip.files).filter(e=>!e.dir&&supported.has(e.name.split('.').pop().toLowerCase())&&!e.name.startsWith('__MACOSX/')&&!/\/(?:qa|reports)\//i.test(e.name));
    // When using the PFI package, only use its documents folder, not reports/fixtures.
    const hasDocs=valid.some(e=>e.name.startsWith('documents/'));
    const entries=valid.filter(e=>!hasDocs||e.name.startsWith('documents/')).slice(0,120);
    if(!entries.length)throw Error('ZIP contains no supported development documents');
    for(const e of entries){const bytes=await e.async('uint8array');const r=await addDoc(e.name,bytes,file.name);if(r?.status==='skipped')errors.push(r.message)}
   }catch(e){errors.push(file.name+': '+String(e?.message||e))}
  }else if(supported.has(ext)){
    try{const bytes=new Uint8Array(await file.arrayBuffer());const r=await addDoc(file.name,bytes,'manual upload');if(r?.status==='skipped')errors.push(r.message)}
    catch(e){errors.push(file.name+': '+String(e?.message||e))}
  }else errors.push(file.name+': unsupported file format');
 }
 }finally{state.busy=false;refresh();$('process-note').textContent=errors.length?'Skipped/unsupported: '+errors.slice(0,3).join('; '):state.docs.filter(d=>d.status==='parsed').length+' successfully read · '+state.docs.filter(d=>d.status==='error').length+' failed · Financial reviews shown separately';
 if(errors.length)console.warn('PFI QA intake warnings:',errors)}
}
function exportData(){
 const m=state.model;if(!m||!m.docs.length)return;
 const data={application:'PFI Construction Intelligence',testMode:state.mode,technicalUploadFailures:m.errors,duplicateFormats:m.duplicates.map(d=>d.name),classification:'SYNTHETIC QA · NOT APPROVED ACCOUNTING DATA',generatedAt:new Date().toISOString(),project:m.values.name||'Unnamed development',fields:m.values,fieldEvidence:Object.fromEntries(Object.entries(m.sources).map(([k,v])=>[k,{source:v.source,location:v.location,evidence:v.evidence,provisional:true}])),budget:{land:m.values.land,residential:m.values.residential,retail:m.values.retailcost,parking:m.values.parkingcost,indirect:m.values.indirect,total:m.cost},sales:{condominium:m.values.condosales,retail:m.values.retailsales,gross:m.gross,sellingExpenses:m.values.salesexpenses,net:m.net},preFinancingProfit:m.profit,approvedChangeCostScenarioNotPosted:m.approvedDelta,monthlyForecast:m.draws,unitSellout:m.sellout,diligenceRisks:m.risks,permitGates:m.permits,issues:m.issues,conflicts:m.conflicts,documents:m.docs.map(d=>({name:d.name,kind:d.kind,status:d.status,fields:d.fields?.length||0})),limitations:['No database persistence','No automatic accounting write-back','No independently certified PDF/OCR extraction','No GAAP/loan authorization','Financial outputs require review']};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PFI-Development-Intelligence-Review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function clearWorkspaceState(){
 state.docs=[];state.mode='blank';state.next=1;state.busy=false;
 const pick=$('file-input');if(pick)pick.value='';
 try{localStorage.setItem('pfi-unified-cleared-v1','1')}catch(e){}
 mode('blank');showView('overview');
}
function init(){
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='PFI_CLEAR_UPLOADS')clearWorkspaceState()});
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
 // Dynamic empty view links use event delegation.
 document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)showView(b.dataset.go)});
 document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view));
 $('mode-blank').onclick=()=>mode('blank');$('mode-test').onclick=()=>mode('test');
 $('btn-export').onclick=exportData;$('exceptions-export').onclick=exportData;
 $('btn-reset').onclick=()=>{if(!confirm('Reset the entire PFI workspace? Clear uploaded files, financial results and saved sample data from all five sections?'))return;clearWorkspaceState();if(window.parent&&window.parent!==window)window.parent.postMessage({type:'PFI_RESET_ALL'},location.origin);};
 $('clear-files').onclick=()=>{if(!state.docs.length)return;if(!confirm('Remove every uploaded file and clear its model contributions?'))return;state.docs=[];refresh()};
 const zone=$('drop-area'),pick=$('file-input');
 $('pick-files').addEventListener('click',e=>{e.stopPropagation();pick.click()});
 zone.addEventListener('click',e=>{if(e.target!==pick)pick.click()});
 pick.addEventListener('click',e=>e.stopPropagation());
 zone.addEventListener('keydown',e=>{if(e.target===zone&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pick.click()}});
 pick.onchange=()=>{const f=Array.from(pick.files);pick.value='';ingestFiles(f)};
 for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('drag')});
 for(const event of ['dragleave','drop'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.remove('drag')});
 zone.addEventListener('drop',e=>ingestFiles(e.dataTransfer.files));
 $('process-files').onclick=async()=>{if(state.busy||!state.docs.length)return;state.busy=true;refresh();for(const doc of state.docs.slice()){doc.status='reading';try{await parseDocument(doc,doc.bytes)}catch(e){doc.status='error';doc.error=String(e.message||e).slice(0,230)}refresh()}state.busy=false;refresh()};
 if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc='/assets/vendor/pdf.worker.min.js';
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
