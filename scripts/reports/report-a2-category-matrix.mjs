/** A2: Category Coverage Matrix — offline/online */
import{isOffline,sqlQuery,sqlGet,mdH2,mdTable,pct,registerReport,getDB}from"./lib/report-utils.js";
registerReport({id:"a2",suite:"A",title:"Category Coverage Matrix",etaSeconds:1,async run(){
let md=mdH2("A2: Category Coverage Matrix"),rows=[];
if(isOffline()){
rows=sqlQuery("SELECT COALESCE(c.name,'unknown') AS category, COUNT(*) AS total, COUNT(*)FILTER(WHERE u.inactive IS NULL OR u.inactive=0) AS active, COUNT(*)FILTER(WHERE u.inactive=1) AS inactive, COUNT(*)FILTER(WHERE u.approved=1 AND (u.inactive IS NULL OR u.inactive=0) AND u.upvotes>0) AS rated, ROUND(AVG(CASE WHEN u.upvotes>0 THEN u.wilson_score ELSE NULL END)*100,1) AS avg_w FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id GROUP BY c.name ORDER BY total DESC");
}else{
const{data:a,error}=await getDB().rpc("admin_analytics");
if(!error)rows=a.category_matrix||[];
}
if(!rows.length){md+="_No data._\n";return md;}
const t=rows.reduce((s,r)=>s+(r.total||0),0);
md+=mdTable(rows.slice(0,30).map(r=>({category:r.category,total:r.total,active:r.active,inactive:r.inactive,rated:r.rated,avgW:r.avg_w?r.avg_w.toFixed(1)+"%":"-",pct:pct(r.total,t)})),[{key:"category",label:"Category"},{key:"total",label:"Total",align:"right",format:v=>v.toLocaleString()},{key:"active",label:"Active",align:"right",format:v=>v.toLocaleString()},{key:"inactive",label:"Inactive",align:"right",format:v=>v.toLocaleString()},{key:"rated",label:"Rated",align:"right",format:v=>v.toLocaleString()},{key:"avgW",label:"Avg W",align:"right"},{key:"pct",label:"% Pool",align:"right"}]);
return md;
}});