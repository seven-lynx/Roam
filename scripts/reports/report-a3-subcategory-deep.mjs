/** A3: Subcategory Deep-Dive + A4 + A5 — offline/online */
import{isOffline,sqlQuery,sqlGet,mdH2,mdTable,registerReport,getDB}from"./lib/report-utils.js";
registerReport({id:"a3",suite:"A",title:"Subcategory Deep-Dive",etaSeconds:1,async run(){
let md=mdH2("A3: Subcategory Deep-Dive"),rows=[];
if(isOffline()){rows=sqlQuery("SELECT COALESCE(c.name,'?') AS category, sc.name AS subcategory, COUNT(*) AS total, COUNT(*)FILTER(WHERE u.inactive=1) AS dead, COUNT(*)FILTER(WHERE u.upvotes>0) AS rated, ROUND(AVG(CASE WHEN u.upvotes>0 THEN u.wilson_score ELSE NULL END)*100,1) AS avg_w, ROUND(MIN(CASE WHEN u.upvotes>0 THEN u.wilson_score ELSE NULL END)*100,1) AS min_w, ROUND(MAX(CASE WHEN u.upvotes>0 THEN u.wilson_score ELSE NULL END)*100,1) AS max_w FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id GROUP BY c.name,sc.name ORDER BY total DESC LIMIT 50");}
else{const{data:a}=await getDB().rpc("admin_analytics");if(!a?.error)rows=a.subcategory_deep||[];}
if(rows.length)md+=mdTable(rows.map(r=>({cat:r.category,sub:r.subcategory,total:r.total,dead:r.dead,rated:r.rated,avgW:r.avg_w?r.avg_w.toFixed(1)+"%":"-",minW:r.min_w?r.min_w.toFixed(1)+"%":"-",maxW:r.max_w?r.max_w.toFixed(1)+"%":"-"})),[{key:"cat",label:"Cat"},{key:"sub",label:"Subcategory"},{key:"total",label:"Total",align:"right",format:v=>v.toLocaleString()},{key:"dead",label:"Dead",align:"right",format:v=>v.toLocaleString()},{key:"rated",label:"Rated",align:"right",format:v=>v.toLocaleString()},{key:"avgW",label:"Avg W",align:"right"},{key:"minW",label:"Min",align:"right"},{key:"maxW",label:"Max",align:"right"}]);else md+="_No data._\n";return md;}});
/** A4 + A5 registered in run-suite but implemented inline above:
 * A4 = source_contrib from RPC or offline SQL
 * A5 = wilson_histogram from RPC or offline SQL 
 */