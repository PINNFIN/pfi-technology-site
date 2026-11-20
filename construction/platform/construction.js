
const D={job:{name:"PFI Fictional Contractor Job",contract:2150000,retainage:10,previousNet:380000,stored:15000,dailyGC:950,dailyFinance:400},
 codes:[
 {id:"01",trade:"General Requirements",bucket:"indirect",estimate:85000,committed:65000,actual:27000,ctc:66000,progress:30,planned:45,source:"DEMO estimate page 2"},
 {id:"31",trade:"Earthwork",bucket:"residential",estimate:120000,committed:105000,actual:40000,ctc:83000,progress:45,planned:55,source:"DEMO civil bid"},
 {id:"03",trade:"Concrete",bucket:"residential",estimate:265000,committed:240000,actual:146000,ctc:143000,progress:55,planned:60,source:"DEMO SOV page 5"},
 {id:"05",trade:"Structural Steel",bucket:"residential",estimate:320000,committed:295000,actual:95000,ctc:245000,progress:28,planned:40,source:"DEMO steel bid"},
 {id:"07",trade:"Roofing",bucket:"residential",estimate:150000,committed:112000,actual:35000,ctc:136000,progress:20,planned:30,source:"UNVERIFIED sample allowance"},
 {id:"09",trade:"Finishes",bucket:"residential",estimate:245000,committed:210000,actual:30000,ctc:224000,progress:8,planned:20,source:"DEMO finish takeoff"},
 {id:"23",trade:"Mechanical",bucket:"residential",estimate:280000,committed:260000,actual:89000,ctc:220000,progress:27,planned:40,source:"DEMO MEP bid"},
 {id:"26",trade:"Electrical",bucket:"residential",estimate:185000,committed:165000,actual:52000,ctc:144000,progress:25,planned:32,source:"DEMO electrical bid"}],
 changes:[
 {id:"CO-001",title:"Additional steel connections",code:"05",cost:18000,revenue:26000,actual:4000,ctc:14000,earned:10,status:"Approved",reviewer:"Demo manager",evidence:"DEMO CO approval"},
 {id:"CO-002",title:"Roof membrane upgrade",code:"07",cost:11000,revenue:17000,actual:0,ctc:11000,earned:0,status:"Submitted",reviewer:"",evidence:"DEMO unapproved RFI"}],
 materials:[{id:"MAT-001",title:"6-inch concrete slab",code:"03",qty:10000,measure:"SF",factor:1/54,waste:5,pack:0.25,unit:"CY",unitPrice:185,source:"DEMO slab measurement"}],
 pos:[],
 milestones:[
 {id:"S1",name:"Foundation complete",baseline:"2027-06-01",forecast:"2027-06-15",critical:true},
 {id:"S2",name:"Steel topped out",baseline:"2027-10-01",forecast:"2027-10-20",critical:true},
 {id:"S3",name:"MEP rough-in",baseline:"2028-01-20",forecast:"2028-02-04",critical:true},
 {id:"S4",name:"Interiors complete",baseline:"2028-05-01",forecast:"2028-05-03",critical:false}]
};
let S=JSON.parse(JSON.stringify(D)),sel={code:"01",co:"CO-001",mat:"MAT-001",po:"",milestone:"S1"},tab="summary";
const num=x=>Number(x)||0,money=x=>Number(x).toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}),pct=x=>(100*x).toFixed(1)+"%";
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const days=(a,b)=>(Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000;
function takeoff(m){let raw=m.qty*m.factor*(1+m.waste/100),packs=Math.ceil((raw-1e-10)/m.pack);return {order:packs*m.pack,total:packs*m.pack*m.unitPrice};}
function compute(s){
 let estimate=s.codes.reduce((v,c)=>v+c.estimate,0),approved=s.changes.filter(c=>c.status==="Approved"),pending=s.changes.filter(c=>c.status==="Submitted");
 let costChange=approved.reduce((v,c)=>v+c.cost,0),revenueChange=approved.reduce((v,c)=>v+c.revenue,0),revisedBudget=estimate+costChange,contract=s.job.contract+revenueChange;
 let baseActual=s.codes.reduce((v,c)=>v+c.actual,0),baseCTC=s.codes.reduce((v,c)=>v+c.ctc,0),coActual=approved.reduce((v,c)=>v+c.actual,0),coCTC=approved.reduce((v,c)=>v+c.ctc,0);
 let criticalDelay=Math.max(0,...s.milestones.filter(x=>x.critical).map(x=>days(x.baseline,x.forecast)));
 let carry=criticalDelay*(s.job.dailyGC+s.job.dailyFinance),actual=baseActual+coActual,ctc=baseCTC+coCTC,eac=actual+ctc+carry;
 let existingCommitted=s.codes.reduce((v,c)=>v+c.committed,0),newPOCommitted=s.pos.filter(p=>p.status==="Committed").reduce((v,p)=>v+p.value,0);
 let originalEarned=s.codes.reduce((v,c)=>v+(estimate?s.job.contract*c.estimate/estimate*c.progress/100:0),0);
 let coEarned=approved.reduce((v,c)=>v+c.revenue*c.earned/100,0),earned=originalEarned+coEarned+s.job.stored,retain=earned*s.job.retainage/100,netEarned=earned-retain,netDue=netEarned-s.job.previousNet;
 let codeRows=s.codes.map(c=>{let co=approved.filter(x=>x.code===c.id);let coBudget=co.reduce((v,x)=>v+x.cost,0),coF=co.reduce((v,x)=>v+x.actual+x.ctc,0);return {...c,coBudget,revised:c.estimate+coBudget,eac:c.actual+c.ctc+coF,variance:c.estimate+coBudget-c.actual-c.ctc-coF};});
 let flags=codeRows.filter(c=>c.variance<0).map(c=>({level:"Overrun",msg:c.trade+" forecast exceeds approved budget by "+money(-c.variance)}));
 codeRows.filter(c=>c.progress<c.planned).forEach(c=>flags.push({level:"Behind schedule",msg:c.trade+": "+(c.planned-c.progress)+" progress points behind baseline"}));
 if(criticalDelay>0)flags.push({level:"Carry exposure",msg:criticalDelay+" critical delay days · "+money(carry)+" illustrative incremental cost"});
 if(pending.length)flags.push({level:"Unapproved changes",msg:pending.length+" pending CO(s), "+money(pending.reduce((v,c)=>v+c.cost,0))+" cost at risk"});
 if(netDue<0)flags.push({level:"Billing anomaly",msg:"Prior certified payment exceeds current earned balance"});
 return {estimate,costChange,revenueChange,revisedBudget,contract,actual,ctc,criticalDelay,carry,eac,profit:contract-eac,margin:contract?(contract-eac)/contract:0,existingCommitted,newPOCommitted,committed:existingCommitted+newPOCommitted,originalEarned,coEarned,earned,retain,netEarned,netDue,codeRows,flags,approved,pending};
}
const el=id=>document.getElementById(id);
function save(){try{localStorage.setItem("pfi-construction-v07",JSON.stringify(S))}catch(e){}}
function load(){try{let d=JSON.parse(localStorage.getItem("pfi-construction-v07")||"null");if(d&&Array.isArray(d.codes))S=d}catch(e){}}
function kv(id,arr){el(id).innerHTML=arr.map(([a,b])=>'<div class="kv"><span>'+safe(a)+'</span><strong>'+safe(b)+'</strong></div>').join("")}
function cards(id,arr){el(id).innerHTML=arr.map(([a,b])=>'<div class="metric"><small>'+safe(a)+'</small><strong>'+safe(b)+'</strong></div>').join("")}
function input(id,label,value,type="number"){return '<label class="field">'+safe(label)+'<input id="'+id+'" type="'+type+'" '+(type==="number"?'step="any" min="0"':'')+' value="'+safe(value)+'"></label>'}
function select(id,label,values,chosen){return '<label class="field">'+safe(label)+'<select id="'+id+'">'+values.map(v=>'<option '+(v===chosen?"selected":"")+' value="'+safe(v)+'">'+safe(v)+'</option>').join("")+'</select></label>'}
function read(id){return el(id).value.trim()}
function number(id){return Number(read(id))}
function valid(obj,names){return names.every(k=>Number.isFinite(obj[k])&&obj[k]>=0)}
function persist(){save();render()}
function render(){let x=compute(S);
 cards("metrics",[["Original estimate",money(x.estimate)],["Revised cost budget",money(x.revisedBudget)],["Estimated cost at completion",money(x.eac)],["Projected gross profit",money(x.profit)]]);
 kv("summaryCost",[["Original trade estimate",money(x.estimate)],["Approved CO cost budget",money(x.costChange)],["Actual including approved COs",money(x.actual)],["Forecast cost to complete",money(x.ctc)],["Incremental schedule carry",money(x.carry)],["EAC against revised budget",money(x.revisedBudget-x.eac)]]);
 kv("summaryRevenue",[["Original customer contract",money(S.job.contract)],["Approved CO revenue",money(x.revenueChange)],["Revised customer contract",money(x.contract)],["Existing committed amounts",money(x.existingCommitted)],["Committed new purchase orders",money(x.newPOCommitted)],["Progress billing currently due",money(x.netDue)],["Forecast gross margin",pct(x.margin)]]);
 el("flags").innerHTML=x.flags.map(f=>'<div class="flag"><b>'+safe(f.level)+'</b> · '+safe(f.msg)+'</div>').join("")||"<p>No cost or schedule exceptions under current inputs.</p>";
 el("costTable").innerHTML=x.codeRows.map(c=>'<tr><td><button class="mini" onclick="editCode('+JSON.stringify(c.id)+')">'+safe(c.id)+'</button> '+safe(c.trade)+'</td>'+[c.estimate,c.coBudget,c.revised,c.committed,c.actual,c.ctc,c.eac,c.variance].map(v=>'<td>'+money(v)+'</td>').join("")+'<td>'+safe(c.progress)+'%</td><td>'+safe(c.source)+'</td></tr>').join("");
 codeEditor();
 cards("coCards",[["Approved CO cost",money(x.costChange)],["Approved CO revenue",money(x.revenueChange)],["Pending COs",x.pending.length],["Approved COs",x.approved.length]]);
 el("coTable").innerHTML=S.changes.map(c=>'<tr><td><button class="mini" onclick="editCO('+JSON.stringify(c.id)+')">'+safe(c.id)+'</button></td><td>'+safe(c.title)+'</td><td>'+safe(c.code)+'</td><td>'+money(c.cost)+'</td><td>'+money(c.revenue)+'</td><td>'+safe(c.status)+'</td><td>'+safe(c.reviewer||"—")+'</td></tr>').join("");
 coEditor();
 el("materialTable").innerHTML=S.materials.map(m=>{let q=takeoff(m);return '<tr><td><button class="mini" onclick="editMaterial('+JSON.stringify(m.id)+')">'+safe(m.id)+'</button> '+safe(m.title)+'</td><td>'+safe(m.code)+'</td><td>'+m.qty+' '+safe(m.measure)+'</td><td>'+m.waste+'%</td><td>'+q.order+' '+safe(m.unit)+'</td><td>'+money(q.total)+'</td><td>'+safe(m.source)+'</td></tr>'}).join("");
 materialEditor();
 el("poTable").innerHTML=S.pos.map(p=>'<tr><td><button class="mini" onclick="editPO('+JSON.stringify(p.id)+')">'+safe(p.id)+'</button></td><td>'+safe(p.vendor)+'</td><td>'+money(p.value)+'</td><td>'+safe(p.status)+'</td><td>'+safe(p.reviewer||"—")+'</td></tr>').join("")||'<tr><td colspan="5">No purchase orders yet</td></tr>';
 poEditor();
 cards("billingCards",[["Gross earned",money(x.earned)],["Retainage",money(x.retain)],["Net cumulative earned",money(x.netEarned)],["Current amount due",money(x.netDue)]]);
 el("billInputs").innerHTML='<div class="fields">'+input("jContract","Original client contract",S.job.contract)+input("jRet","Retainage percent",S.job.retainage)+input("jPrior","Previously certified net",S.job.previousNet)+input("jStored","Uninstalled stored materials",S.job.stored)+input("jGC","Additional daily general conditions",S.job.dailyGC)+input("jDebt","Additional daily financing carry",S.job.dailyFinance)+'</div><button onclick="saveBilling()">Apply Billing Settings</button>';
 kv("billingMath",[["Installed original-work earnings",money(x.originalEarned)],["Approved CO earnings",money(x.coEarned)],["Stored materials (assumed eligible)",money(S.job.stored)],["Total gross earned",money(x.earned)],["Less retainage",money(x.retain)],["Net eligible",money(x.netEarned)],["Less prior net certified",money(S.job.previousNet)],["Current request, subject to review",money(x.netDue)]]);
 cards("scheduleCards",[["Critical schedule delay",x.criticalDelay+" days"],["Additional GC + finance per day",money(S.job.dailyGC+S.job.dailyFinance)],["Scenario carry exposure",money(x.carry)],["Trades behind planned progress",x.codeRows.filter(c=>c.progress<c.planned).length]]);
 el("scheduleTable").innerHTML=S.milestones.map(m=>'<tr><td><button class="mini" onclick="editMilestone('+JSON.stringify(m.id)+')">'+safe(m.name)+'</button></td><td>'+safe(m.baseline)+'</td><td>'+safe(m.forecast)+'</td><td>'+days(m.baseline,m.forecast)+'</td><td>'+ (m.critical?"Yes":"No")+'</td></tr>').join("");
 milestoneEditor();
 const checks=[
 ["Approved change orders bridge to cost budget",Math.abs(x.revisedBudget-x.estimate-x.costChange)<.01],
 ["Approved change orders bridge to client contract",Math.abs(x.contract-S.job.contract-x.revenueChange)<.01],
 ["EAC reconciles actual + forecast remaining + incremental carry",Math.abs(x.eac-x.actual-x.ctc-x.carry)<.01],
 ["Gross profit reconciles to revised contract less EAC",Math.abs(x.profit-x.contract+x.eac)<.01],
 ["Certified net reconciles earnings less retainage",Math.abs(x.netEarned-x.earned+x.retain)<.01]
 ];
 kv("checks",checks.map(([label,ok])=>[label,ok?"PASS":"FAIL"]));
 const bridge={};x.codeRows.forEach(c=>{const k=c.bucket||"residential";bridge[k]=(bridge[k]||0)+c.eac});
 kv("bridge",Object.entries(bridge).map(([k,v])=>[k+" cost EAC",money(v)]).concat([["Unallocated incremental carry",money(x.carry)]]));
 }
function editCode(id){sel.code=id;codeEditor()}
function codeEditor(){const c=S.codes.find(x=>x.id===sel.code)||S.codes[0];if(!c)return;el("costEditor").innerHTML='<h2>Edit '+safe(c.trade)+'</h2><div class="fields">'+input("cEstimate","Original estimate",c.estimate)+input("cCommit","Existing commitments (exclude new POs)",c.committed)+input("cActual","Posted actual",c.actual)+input("cCTC","Forecast remaining",c.ctc)+input("cProgress","Progress completed %",c.progress)+input("cPlanned","Planned progress %",c.planned)+input("cEvidence","Document reference",c.source,"text")+select("cBucket","Development budget mapping",["residential","indirect","retailcost","parkingcost"],c.bucket)+'</div><button onclick="saveCode()">Save Cost Code</button>'}
function saveCode(){const c=S.codes.find(x=>x.id===sel.code);const v={estimate:number("cEstimate"),committed:number("cCommit"),actual:number("cActual"),ctc:number("cCTC"),progress:number("cProgress"),planned:number("cPlanned"),source:read("cEvidence"),bucket:read("cBucket")};if(!valid(v,["estimate","committed","actual","ctc","progress","planned"])||v.progress>100||v.planned>100){alert("Invalid amount or completion percent.");return}Object.assign(c,v);persist()}
function editCO(id){sel.co=id;coEditor()}
function coEditor(){const c=S.changes.find(x=>x.id===sel.co)||S.changes[0];if(!c)return;el("coEditor").innerHTML='<h2>'+safe(c.id)+' · Approval Review</h2><div class="fields">'+input("coTitle","Scope",c.title,"text")+select("coCode","Cost code",S.codes.map(z=>z.id),c.code)+input("coCost","Estimated / approved cost",c.cost)+input("coRevenue","Requested / approved client price",c.revenue)+input("coActual","Approved CO posted actual",c.actual)+input("coCTC","Approved CO cost remaining",c.ctc)+input("coEarned","Approved CO percent complete",c.earned)+select("coStatus","Status",["Draft","Submitted","Approved","Rejected"],c.status)+input("coReviewer","Approving reviewer",c.reviewer,"text")+input("coSource","Approval document / evidence",c.evidence,"text")+'</div><button onclick="saveCO()">Save Change Order</button><p class="muted">Only Approved COs are included in revised budget and earned revenue. Approval requires reviewer and evidence.</p>'}
function addCO(){let id="CO-"+String(S.changes.length+1).padStart(3,"0");S.changes.push({id,title:"New scope change",code:S.codes[0].id,cost:0,revenue:0,actual:0,ctc:0,earned:0,status:"Draft",reviewer:"",evidence:""});sel.co=id;persist()}
function saveCO(){const c=S.changes.find(x=>x.id===sel.co);const v={title:read("coTitle"),code:read("coCode"),cost:number("coCost"),revenue:number("coRevenue"),actual:number("coActual"),ctc:number("coCTC"),earned:number("coEarned"),status:read("coStatus"),reviewer:read("coReviewer"),evidence:read("coSource")};if(!valid(v,["cost","revenue","actual","ctc","earned"])||v.earned>100){alert("Invalid change order.");return}if(v.status==="Approved"&&(!v.reviewer||!v.evidence)){alert("A documented reviewer is required to approve.");return}Object.assign(c,v);persist()}
function editMaterial(id){sel.mat=id;materialEditor()}
function materialEditor(){const m=S.materials.find(x=>x.id===sel.mat)||S.materials[0];if(!m)return;el("matEditor").innerHTML='<h2>'+safe(m.id)+' · Takeoff Inputs</h2><div class="fields">'+input("mTitle","Material name",m.title,"text")+select("mCode","Cost code",S.codes.map(c=>c.id),m.code)+input("mQty","Measured quantity",m.qty)+input("mMeasure","Measure unit",m.measure,"text")+input("mFactor","Conversion to procurement units",m.factor)+input("mWaste","Waste %",m.waste)+input("mPack","Purchasable order increment",m.pack)+input("mUnit","Procurement unit",m.unit,"text")+input("mPrice","Price per procurement unit",m.unitPrice)+input("mSource","Drawing / measured quantity source",m.source,"text")+'</div><button onclick="saveMaterial()">Save Material</button><button onclick="addPO()">Create Draft PO from Takeoff</button>'}
function addMaterial(){const id="MAT-"+String(S.materials.length+1).padStart(3,"0");S.materials.push({id,title:"New material",code:S.codes[0].id,qty:0,measure:"EA",factor:1,waste:0,pack:1,unit:"EA",unitPrice:0,source:""});sel.mat=id;persist()}
function saveMaterial(){const m=S.materials.find(x=>x.id===sel.mat);const v={title:read("mTitle"),code:read("mCode"),qty:number("mQty"),measure:read("mMeasure"),factor:number("mFactor"),waste:number("mWaste"),pack:number("mPack"),unit:read("mUnit"),unitPrice:number("mPrice"),source:read("mSource")};if(!valid(v,["qty","factor","waste","pack","unitPrice"])||v.pack<=0||v.factor<=0){alert("Material factor and pack increment must be positive.");return}Object.assign(m,v);persist()}
function addPO(){saveMaterial();const m=S.materials.find(x=>x.id===sel.mat);const id="PO-"+String(S.pos.length+1).padStart(3,"0");S.pos.push({id,matId:m.id,vendor:"Not yet quoted",value:takeoff(m).total,status:"Draft",reviewer:"",evidence:""});sel.po=id;persist()}
function editPO(id){sel.po=id;poEditor()}
function poEditor(){const p=S.pos.find(x=>x.id===sel.po)||S.pos[0];if(!p){el("poEditor").innerHTML='<p>Start by creating a draft PO from a takeoff line. No supplier order is transmitted.</p>';return}el("poEditor").innerHTML='<h2>'+safe(p.id)+' · Purchase Commitment</h2><div class="fields">'+input("pVendor","Vendor",p.vendor,"text")+input("pValue","Commitment amount",p.value)+select("pStatus","Status",["Draft","Approved","Committed","Cancelled"],p.status)+input("pReviewer","Approving reviewer",p.reviewer,"text")+input("pEvidence","Source / signed PO reference",p.evidence,"text")+'</div><button onclick="savePO()">Save Purchase Order</button>'}
function savePO(){const p=S.pos.find(x=>x.id===sel.po);let v={vendor:read("pVendor"),value:number("pValue"),status:read("pStatus"),reviewer:read("pReviewer"),evidence:read("pEvidence")};if(!valid(v,["value"])){alert("Invalid PO amount.");return}if(["Approved","Committed"].includes(v.status)&&(!v.reviewer||!v.evidence)){alert("Approval and commitment require documented reviewer.");return}Object.assign(p,v);persist()}
function saveBilling(){let v={contract:number("jContract"),retainage:number("jRet"),previousNet:number("jPrior"),stored:number("jStored"),dailyGC:number("jGC"),dailyFinance:number("jDebt")};if(!valid(v,Object.keys(v))||v.retainage>100){alert("Invalid billing assumptions.");return}Object.assign(S.job,v);persist()}
function editMilestone(id){sel.milestone=id;milestoneEditor()}
function milestoneEditor(){const m=S.milestones.find(x=>x.id===sel.milestone)||S.milestones[0];if(!m)return;el("milestoneEditor").innerHTML='<h2>'+safe(m.name)+'</h2><div class="fields">'+input("sName","Milestone name",m.name,"text")+input("sBase","Baseline finish",m.baseline,"date")+input("sForecast","Forecast finish",m.forecast,"date")+'<label class="field">Critical schedule activity<select id="sCrit"><option value="Yes" '+(m.critical?"selected":"")+'>Yes</option><option value="No" '+(!m.critical?"selected":"")+'>No</option></select></label></div><button onclick="saveMilestone()">Update Schedule</button>'}
function saveMilestone(){const m=S.milestones.find(x=>x.id===sel.milestone),v={name:read("sName"),baseline:read("sBase"),forecast:read("sForecast"),critical:read("sCrit")==="Yes"};if(!Number.isFinite(days(v.baseline,v.forecast))){alert("Enter valid milestone dates.");return}Object.assign(m,v);persist()}
function exportCSV(name,rows){const data=rows.map(r=>r.map(x=>'"'+String(x??"").replaceAll('"','""')+'"').join(",")).join("\n"),url=URL.createObjectURL(new Blob([data],{type:"text/csv"})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function download(type){const x=compute(S);if(type==="cost")exportCSV("PFI_Cost_Code_EAC.csv",[["Code","Trade","Bucket","Original","Approved CO","Revised Budget","Committed","Actual","CTC","EAC","Variance","Source"],...x.codeRows.map(c=>[c.id,c.trade,c.bucket,c.estimate,c.coBudget,c.revised,c.committed,c.actual,c.ctc,c.eac,c.variance,c.source])]);if(type==="co")exportCSV("PFI_Change_Orders.csv",[["CO","Scope","Code","Cost","Client Revenue","Actual","CTC","Earned %","Status","Reviewer","Evidence"],...S.changes.map(c=>[c.id,c.title,c.code,c.cost,c.revenue,c.actual,c.ctc,c.earned,c.status,c.reviewer,c.evidence])]);if(type==="pay")exportCSV("PFI_Progress_Payment.csv",[["Metric","Value"],["Original Contract",S.job.contract],["Approved CO Revenue",x.revenueChange],["Gross Earned",x.earned],["Retainage",x.retain],["Net Earned",x.netEarned],["Prior Certified",S.job.previousNet],["Current Request",x.netDue]]);if(type==="schedule")exportCSV("PFI_Schedule_Exposure.csv",[["Milestone","Baseline","Forecast","Critical","Slippage Days"],...S.milestones.map(m=>[m.name,m.baseline,m.forecast,m.critical,days(m.baseline,m.forecast)])]);if(type==="bridge"){let b={};x.codeRows.forEach(c=>b[c.bucket]=(b[c.bucket]||0)+c.eac);exportCSV("PFI_Construction_Development_Bridge.csv",[["Category","EAC","Status"],...Object.entries(b).map(([k,v])=>[k,v,"Not linked to development sample"]),["Unallocated schedule carry",x.carry,"Illustrative exposure"]])}}
function reset(){if(!confirm("Reset construction job sample in this browser?"))return;S=JSON.parse(JSON.stringify(D));persist()}
function go(t){tab=t;document.querySelectorAll(".page").forEach(e=>e.classList.toggle("hide",e.id!==t));document.querySelectorAll("aside button").forEach(e=>e.classList.toggle("selected",e.dataset.tab===t))}
function boot(){load();const tabs=[["summary","CFO Job Dashboard"],["costs","Cost Code / EAC"],["change","Change Orders"],["materials","Takeoff / Purchase Orders"],["payapp","Progress Billing"],["schedule","Schedule & Delay Costs"],["controls","Reconciliation / Bridge"]];el("nav").innerHTML=tabs.map(([k,label])=>'<button data-tab="'+k+'" onclick="go(\''+k+'\')">'+label+'</button>').join("");render();go("summary")}
if(typeof document!=="undefined")boot();
