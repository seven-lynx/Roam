/** A1: Pool Overview — works online (RPC) and offline (SQLite) */
import{getDB,isOffline,sqlGet,sqlQuery,mdH2,mdSummaryCards,pct,registerReport}from"./lib/report-utils.js";
registerReport({id:"a1",suite:"A",title:"Pool Overview",etaSeconds:1,async run(){
let md=mdH2("A1: Pool Overview");
if(isOffline()){
const t=s=>sqlGet(s).cnt;
const total=t("SELECT COUNT(*) as cnt FROM urls");
const approved=t("SELECT COUNT(*) as cnt FROM urls WHERE approved=1");
const inactive=t("SELECT COUNT(*) as cnt FROM urls WHERE inactive=1");
const active=t("SELECT COUNT(*) as cnt FROM urls WHERE approved=1 AND (inactive IS NULL OR inactive=0)");
const rated=t("SELECT COUNT(*) as cnt FROM urls WHERE approved=1 AND upvotes>0");  
const users=t("SELECT COUNT(*) as cnt FROM profiles");
md+=mdSummaryCards([
{label:"Total URLs",value:fmt(total)},{label:"Active",value:fmt(active),sub:pct(active,total)+" of total"},
{label:"Inactive",value:fmt(inactive),sub:pct(inactive,total)+" of total"},{label:"Approved",value:fmt(approved),sub:pct(approved,total)+" of total"},
{label:"Rated",value:fmt(rated),sub:pct(rated,active||1)+" of active"},{label:"Total Users",value:fmt(users)}
]);
const vel=s=>sqlGet(s).cnt;
const tw=vel("SELECT COUNT(*) as cnt FROM urls WHERE approved=1 AND created_at>=datetime('now','-7 days')");
const lw=vel("SELECT COUNT(*) as cnt FROM urls WHERE approved=1 AND created_at>=datetime('now','-14 days') AND created_at<datetime('now','-7 days')");
md+=mdH2("Velocity");md+=mdSummaryCards([{label:"This Week",value:fmt(tw)},{label:"Last Week",value:fmt(lw)}]);
return md;
}
// Online: use admin_analytics RPC
const sb=getDB();const{data:a,error}=await sb.rpc("admin_analytics");
if(error){md+="**❌ RPC Error:** "+error.message+"\n";return md;}
const au=a.active_users||{};md+=mdSummaryCards([{label:"DAU",value:String(au.dau||0)},{label:"WAU",value:String(au.wau||0)},{label:"MAU",value:String(au.mau||0)}]);
const v=a.velocity||{};md+=mdH2("Velocity");md+=mdSummaryCards([{label:"This Week",value:fmt(v.this_week)},{label:"Last Week",value:fmt(v.last_week)}]);
return md;
}});
function fmt(n){return(n??0).toLocaleString()}