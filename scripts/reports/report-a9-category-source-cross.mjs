/** A9 + A10: offline/online */
import{isOffline,sqlQuery,sqlGet,mdH2,mdTable,registerReport,getDB}from"./lib/report-utils.js";
const fmt=v=>(v??0).toLocaleString();
registerReport({id:"a9",suite:"A",title:"Category × Source Cross-Tab",etaSeconds:1,async run(){
let md=mdH2("A9: Category × Source Cross-Tab"),rows=[];
if(isOffline())rows=sqlQuery("SELECT cat_name AS category, COUNT(DISTINCT source) AS source_count FROM (SELECT c.name AS cat_name, COALESCE(u.source,'?') AS source FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id WHERE u.source IS NOT NULL) sub GROUP BY cat_name ORDER BY source_count");
if(rows.length)md+=mdTable(rows, [{key:"category",label:"Category"},{key:"source_count",label:"Unique Sources",align:"right",format:fmt}]);else md+="_No data._\n";return md;
}});
registerReport({id:"a10",suite:"A",title:"Interest Coverage",etaSeconds:1,async run(){
let md=mdH2("A10: Interest Coverage (URLs vs Interested Users)"),rows=[];
if(isOffline()){
const cats=sqlQuery("SELECT DISTINCT name FROM categories");
rows=cats.map(c=>{const uc=sqlGet(`SELECT COUNT(DISTINCT user_id) AS cnt FROM user_categories WHERE category_id=(SELECT id FROM categories WHERE name='${c.name.replace(/'/g,"''")}')`);const urlc=sqlGet(`SELECT COUNT(*) AS cnt FROM urls u JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c2 ON c2.id=sc.category_id WHERE c2.name='${c.name.replace(/'/g,"''")}' AND u.approved=1 AND (u.inactive IS NULL OR u.inactive=0)`);return{category:c.name,active_urls:urlc?.cnt||0,interested_users:uc?.cnt||0};}).sort((a,b)=>b.interested_users-a.interested_users);
}
if(rows.length)md+=mdTable(rows,[{key:"category",label:"Category"},{key:"active_urls",label:"Active URLs",align:"right",format:fmt},{key:"interested_users",label:"Interested Users",align:"right",format:fmt}]);else md+="_No data._\n";return md;
}});