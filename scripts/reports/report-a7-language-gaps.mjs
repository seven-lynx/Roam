/** A7: Language Distribution — URLs per language, % of pool. */
import { getSupabase, runQuery, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";
registerReport({id:"a7",suite:"A",title:"Language Distribution",description:"URLs per language, % of total pool",etaSeconds:2,async run(){
  const sb=getSupabase();let md=mdH2("A7: Language Distribution");
  const {data:rows}=await runQuery("Loading language data",()=>sb.from("urls").select("language").not("language","is",null).limit(200000),3);
  if(!rows)return md+"_No data._\n";
  const map=new Map();for(const r of rows){const l=r.language||"unknown";map.set(l,(map.get(l)||0)+1);}
  const sorted=[...map.entries()].map(([lang,count])=>({lang,count})).sort((a,b)=>b.count-a.count);
  const total=sorted.reduce((s,r)=>s+r.count,0);
  md+=mdTable(sorted,[{key:"lang",label:"Language"},{key:"count",label:"Count",align:"right",format:v=>v.toLocaleString()},{key:"pct",label:"% Pool",align:"right",format:(v,r)=>pct(r.count,total)}]);
  md+=`${sorted.length} languages / ${total.toLocaleString()} tagged URLs\n`;return md;
}});