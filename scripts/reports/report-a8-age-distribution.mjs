/** A8: Age Distribution — URLs binned by creation age. */
import { getSupabase, runQuery, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";
registerReport({id:"a8",suite:"A",title:"URL Age Distribution",description:"URLs grouped by age: <1mo, 1-3mo, 3-6mo, 6-12mo, >12mo",etaSeconds:2,async run(){
  const sb=getSupabase();let md=mdH2("A8: URL Age Distribution");
  const {data:rows}=await runQuery("Loading creation dates",()=>sb.from("urls").select("created_at").not("created_at","is",null).limit(200000),3);
  if(!rows)return md+"_No data._\n";
  const now=Date.now();const buckets=[{label:"<1 month",min:0,max:30,b:0},{label:"1-3 months",min:31,max:90,b:0},{label:"3-6 months",min:91,max:180,b:0},{label:"6-12 months",min:181,max:365,b:0},{label:">12 months",min:366,max:Infinity,b:0}];
  for(const r of rows){const days=(now-new Date(r.created_at).getTime())/86400000;for(const b of buckets){if(days<=b.max){b.b++;break;}}}
  const total=rows.length;
  md+=mdTable(buckets.map(b=>({label:b.label,count:b.b})),[{key:"label",label:"Age"},{key:"count",label:"Count",align:"right",format:v=>v.toLocaleString()},{key:"pct",label:"%",align:"right",format:(v,r)=>pct(r.count,total)}]);
  md+=`${total.toLocaleString()} total URLs with creation dates\n`;return md;
}});