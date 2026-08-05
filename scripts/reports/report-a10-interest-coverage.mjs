/** A10: Interest Coverage — URLs available vs users interested per category. Underserved interests. */
import { getSupabase, runQuery, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";
registerReport({id:"a10",suite:"A",title:"Interest Calibration Coverage",description:"URLs available vs users interested per category — find underserved interests",etaSeconds:2,async run(){
  const sb=getSupabase();let md=mdH2("A10: Interest Coverage");
  const {data:urlRows}=await runQuery("Counting URLs per category",()=>sb.from("urls").select("subcategory:subcategories!inner(category:categories(id,name))").eq("approved",true).eq("inactive",false).limit(200000),3);
  const {data:userCats}=await runQuery("Counting user interests",()=>sb.from("user_categories").select("category_id").limit(100000),2);
  const urlMap=new Map();for(const r of urlRows||[]){const cat=r.subcategory?.category?.name||"unknown";urlMap.set(cat,(urlMap.get(cat)||0)+1);}
  const interestMap=new Map();for(const r of userCats||[]){if(r.category_id)interestMap.set(r.category_id,(interestMap.get(r.category_id)||0)+1);}
  // Resolve category_ids to names
  const {data:cats}=await runQuery("Loading category names",()=>sb.from("categories").select("id,name").limit(100),1);
  const catName=new Map();for(const c of cats||[])catName.set(c.id,c.name);
  const all=new Set([...urlMap.keys(),...[...interestMap.keys()].map(id=>catName.get(id)||id)]);
  const rows=[...all].map(name=>{const urls=urlMap.get(name)||0;const users=interestMap.get([...catName.entries()].find(([k,v])=>v===name)?.[0])||0;return{name,urls,users};}).sort((a,b)=>b.users-b.users);
  md+=mdTable(rows,[{key:"name",label:"Category"},{key:"urls",label:"Active URLs",align:"right",format:v=>v.toLocaleString()},{key:"users",label:"Interested Users",align:"right",format:v=>v.toLocaleString()},{key:"ratio",label:"URLs/User",align:"right",format:(v,r)=>r.users>0?(r.urls/r.users).toFixed(1):"∞"}]);
  md+=`Higher URLs/User ratio = well-stocked. Lower = underserved (need more content).\n`;return md;
}});