/** A4 + A5 + A6 + A7 + A8 + A9 + A10: offline/online suite A reports */
import{isOffline,sqlQuery,sqlGet,mdH2,mdH3,mdTable,mdSummaryCards,pct,registerReport,getDB}from"./lib/report-utils.js";
const fmt=v=>(v??0).toLocaleString();

registerReport({id:"a4",suite:"A",title:"Source Contribution",etaSeconds:1,async run(){
let md=mdH2("A4: Source Contribution"),rows=[];
if(isOffline())rows=sqlQuery("SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS total, COUNT(*)FILTER(WHERE approved=1 AND (inactive IS NULL OR inactive=0)) AS active, COUNT(*)FILTER(WHERE inactive=1) AS dead, COUNT(*)FILTER(WHERE upvotes>0) AS rated, ROUND(AVG(CASE WHEN upvotes>0 THEN wilson_score ELSE NULL END)*100,1) AS avg_w, MIN(created_at) AS oldest, MAX(created_at) AS newest FROM urls WHERE source IS NOT NULL GROUP BY source ORDER BY total DESC LIMIT 30");
else{const{data:a}=await getDB().rpc("admin_analytics");if(!a?.error)rows=a.source_contrib||[];}
if(rows.length)md+=mdTable(rows.map(r=>({source:r.source,total:r.total,active:r.active,dead:r.dead,rated:r.rated,avgW:r.avg_w?r.avg_w.toFixed(1)+"%":"-"})),[{key:"source",label:"Source"},{key:"total",label:"Total",align:"right",format:fmt},{key:"active",label:"Active",align:"right",format:fmt},{key:"rated",label:"Rated",align:"right",format:fmt},{key:"avgW",label:"Avg W",align:"right"}]);return md;
}});

registerReport({id:"a5",suite:"A",title:"Wilson Histogram",etaSeconds:1,async run(){
let md=mdH2("A5: Wilson Score Histogram"),buckets=[];
if(isOffline()){const q=s=>sqlGet(`SELECT COUNT(*) AS cnt FROM urls WHERE approved=1 AND (inactive IS NULL OR inactive=0)${s}`).cnt;const u=q(" AND (upvotes+downvotes)=0");buckets=[{bucket:"0 (unrated)",count:u},{bucket:"1-10%",count:q(" AND wilson_score>0 AND wilson_score<=0.10")},{bucket:"11-25%",count:q(" AND wilson_score>0.10 AND wilson_score<=0.25")},{bucket:"26-50%",count:q(" AND wilson_score>0.25 AND wilson_score<=0.50")},{bucket:"51-75%",count:q(" AND wilson_score>0.50 AND wilson_score<=0.75")},{bucket:"76-90%",count:q(" AND wilson_score>0.75 AND wilson_score<=0.90")},{bucket:"91-99%",count:q(" AND wilson_score>0.90 AND wilson_score<1.0")},{bucket:"100%",count:q(" AND wilson_score=1.0")}];}
else{const{data:a}=await getDB().rpc("admin_analytics");if(!a?.error)buckets=a.wilson_histogram||[];}
if(buckets.length){const t=buckets.reduce((s,r)=>s+(r.count||0),0);md+=mdTable(buckets.map(r=>({bucket:r.bucket,count:r.count,pct:t>0?(r.count/t*100).toFixed(1)+"%":"-"})),[{key:"bucket",label:"Bucket"},{key:"count",label:"Count",align:"right",format:fmt},{key:"pct",label:"%",align:"right"}]);}
return md;
}});

registerReport({id:"a6",suite:"A",title:"Zero-Vote Gaps",etaSeconds:1,async run(){
let md=mdH2("A6: Zero-Vote Gaps by Category"),rows=[];
if(isOffline())rows=sqlQuery("SELECT COALESCE(c.name,'unknown') AS category, COUNT(*) AS zero_votes FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id WHERE u.approved=1 AND u.upvotes=0 AND u.downvotes=0 GROUP BY c.name ORDER BY zero_votes DESC");
if(rows.length)md+=mdTable(rows.map(r=>({category:r.category,count:r.zero_votes})),[{key:"category",label:"Category"},{key:"count",label:"Zero-Vote URLs",align:"right",format:fmt}]);else md+="_No data._\n";return md;
}});

registerReport({id:"a7",suite:"A",title:"Language Distribution",etaSeconds:1,async run(){
let md=mdH2("A7: Language Distribution"),rows=[];
if(isOffline())rows=sqlQuery("SELECT COALESCE(language,'unknown') AS language, COUNT(*) AS count FROM urls GROUP BY language ORDER BY count DESC");
if(rows.length)md+=mdTable(rows.map(r=>({lang:r.language,count:r.count})),[{key:"lang",label:"Language"},{key:"count",label:"Count",align:"right",format:fmt}]);else md+="_No data._\n";return md;
}});

registerReport({id:"a8",suite:"A",title:"Age Distribution",etaSeconds:1,async run(){
let md=mdH2("A8: URL Age Distribution"),buckets=[],t=0;
if(isOffline()){t=sqlGet("SELECT COUNT(*) AS cnt FROM urls").cnt;
buckets=[
{label:"<1 month",cnt:sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE datetime(created_at)>=datetime('now','-30 days')").cnt},
{label:"1-3 months",cnt:sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE datetime(created_at)>=datetime('now','-90 days') AND datetime(created_at)<datetime('now','-30 days')").cnt},
{label:"3-6 months",cnt:sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE datetime(created_at)>=datetime('now','-180 days') AND datetime(created_at)<datetime('now','-90 days')").cnt},
{label:"6-12 months",cnt:sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE datetime(created_at)>=datetime('now','-365 days') AND datetime(created_at)<datetime('now','-180 days')").cnt},
{label:">12 months",cnt:sqlGet("SELECT COUNT(*) AS cnt FROM urls WHERE datetime(created_at)<datetime('now','-365 days')").cnt},
];}
if(buckets.length)md+=mdTable(buckets.map(r=>({bucket:r.label,count:r.cnt,pct:pct(r.cnt,t)})),[{key:"bucket",label:"Age"},{key:"count",label:"URLs",align:"right",format:fmt},{key:"pct",label:"%",align:"right"}]);return md;
}});