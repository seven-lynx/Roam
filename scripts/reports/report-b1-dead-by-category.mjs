/** Suite B: Content Health reports (B1-B6), offline-first */
import{isOffline,sqlQuery,sqlGet,mdH2,mdTable,mdSummaryCards,pct,registerReport,getDB}from"./lib/report-utils.js";
const fmt=v=>(v??0).toLocaleString();

registerReport({id:"b1",suite:"B",title:"Dead URLs by Category",etaSeconds:1,async run(){
let md=mdH2("B1: Dead URLs by Category"),rows=[];
if(isOffline())rows=sqlQuery("SELECT COALESCE(c.name,'unknown') AS category, COUNT(*) AS total, COUNT(*)FILTER(WHERE u.inactive=1) AS dead FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id GROUP BY c.name ORDER BY total DESC");
else{const a=await getDB().rpc("admin_analytics");if(!a?.error)rows=a.dead_by_category||[];}
if(rows.length)md+=mdTable(rows.filter(r=>r.dead>0).map(r=>({category:r.category,total:r.total,dead:r.dead,pct:pct(r.dead,r.total)})),[{key:"category",label:"Category"},{key:"total",label:"Total",align:"right",format:fmt},{key:"dead",label:"Dead",align:"right",format:fmt},{key:"pct",label:"% Dead",align:"right"}]);return md;
}});

registerReport({id:"b2",suite:"B",title:"Dead URLs by Seeder",etaSeconds:1,async run(){
let md=mdH2("B2: Dead URLs by Seeder"),rows=[];
if(isOffline())rows=sqlQuery("SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS total, COUNT(*)FILTER(WHERE inactive=1) AS dead FROM urls WHERE source IS NOT NULL GROUP BY source ORDER BY total DESC LIMIT 30");
if(rows.length)md+=mdTable(rows.filter(r=>r.dead>0).map(r=>({source:r.source,total:r.total,dead:r.dead,pct:pct(r.dead,r.total)})),[{key:"source",label:"Source"},{key:"total",label:"Total",align:"right",format:fmt},{key:"dead",label:"Dead",align:"right",format:fmt},{key:"pct",label:"%",align:"right"}]);return md;
}});

registerReport({id:"b3",suite:"B",title:"Untagged URLs",etaSeconds:1,async run(){
let md=mdH2("B3: Untagged URLs");
if(isOffline()){
const ns=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE subcategory_id IS NULL").cnt;
const nl=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE language IS NULL").cnt;
const t=sqlGet("SELECT COUNT(*) AS cnt FROM urls").cnt;
md+=mdSummaryCards([{label:"No Subcategory",value:fmt(ns)},{label:"No Language",value:fmt(nl)},{label:"Total URLs",value:fmt(t)}]);
}return md;
}});

registerReport({id:"b4",suite:"B",title:"Duplicate URLs",etaSeconds:1,async run(){
let md=mdH2("B4: Duplicate URL Report"),rows=[];
if(isOffline())rows=sqlQuery("SELECT url, COUNT(*) AS copies FROM urls GROUP BY url HAVING COUNT(*)>1 ORDER BY copies DESC LIMIT 50");
if(rows.length)md+=mdTable(rows.map(r=>({url:r.url?.slice(0,80)||"?",copies:r.copies})),[{key:"url",label:"URL"},{key:"copies",label:"Copies",align:"right",format:fmt}]);else md+="_No duplicates found._\n";return md;
}});

registerReport({id:"b5",suite:"B",title:"Paywall Coverage",etaSeconds:1,async run(){
let md=mdH2("B5: Paywall Domain Coverage"),rows=[];
if(isOffline()){rows=sqlQuery("SELECT pd.domain, (SELECT COUNT(*) FROM urls u WHERE u.domain=pd.domain) AS count FROM paywalled_domains pd ORDER BY count DESC");}
if(rows.length)md+=mdTable(rows.map(r=>({domain:r.domain,count:r.count})),[{key:"domain",label:"Domain"},{key:"count",label:"URLs",align:"right",format:fmt}]);return md;
}});

registerReport({id:"b6",suite:"B",title:"Missing OG Metadata",etaSeconds:1,async run(){
let md=mdH2("B6: Missing OG Metadata");
if(isOffline()){
const nt=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE approved=1 AND title IS NULL").cnt;
const nd=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE approved=1 AND description IS NULL").cnt;
const ni=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE approved=1 AND og_image_url IS NULL").cnt;
const t=sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE approved=1").cnt;
md+=mdSummaryCards([{label:"No Title",value:fmt(nt)},{label:"No Description",value:fmt(nd)},{label:"No Image",value:fmt(ni)},{label:"Total Approved",value:fmt(t)}]);
}return md;
}});