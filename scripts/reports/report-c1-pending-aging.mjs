/** Suite C: Moderation & Queue (C1-C4) + D (D1-D6) + E (E1-E4) + F (F1-F3) + G (G1) */
import{isOffline,sqlQuery,sqlGet,mdH2,mdTable,mdSummaryCards,pct,registerReport,getDB}from"./lib/report-utils.js";
const fmt=v=>(v??0).toLocaleString();

// C1
registerReport({id:"c1",suite:"C",title:"Pending Queue Aging",etaSeconds:1,async run(){
let md=mdH2("C1: Pending Queue Aging");if(!isOffline()){md+="_Online not implemented._\n";return md;}let b=[],rows=sqlQuery("SELECT id,status,created_at FROM moderation_queue WHERE status='pending'");
if(!rows.length){b=[{label:"<1 day"}, {label:"1-3 days"}, {label:"3-7 days"}, {label:"7-14 days"}, {label:"14-30 days"}, {label:">30 days"}].map(x=>({label:x.label,cnt:0}));}
else{const t0=new Date();const d=r=>Math.floor((t0-new Date(r.created_at))/86400000);
b=[{label:"<1 day",cnt:rows.filter(r=>d(r)<1).length},{label:"1-3 days",cnt:rows.filter(r=>d(r)>=1&&d(r)<3).length},{label:"3-7 days",cnt:rows.filter(r=>d(r)>=3&&d(r)<7).length},{label:"7-14 days",cnt:rows.filter(r=>d(r)>=7&&d(r)<14).length},{label:"14-30 days",cnt:rows.filter(r=>d(r)>=14&&d(r)<30).length},{label:">30 days",cnt:rows.filter(r=>d(r)>=30).length}];}
md+=mdTable(b.map(r=>({age:r.label,count:r.cnt})),[{key:"age",label:"Age"},{key:"count",label:"Count",align:"right",format:fmt}]);return md;
}});

// C2
registerReport({id:"c2",suite:"C",title:"Reviewer Activity",etaSeconds:1,async run(){
let md=mdH2("C2: Reviewer Activity");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(reviewed_by,'?') AS reviewer, COUNT(*) AS reviewed FROM moderation_queue WHERE reviewed_by IS NOT NULL GROUP BY reviewed_by ORDER BY reviewed DESC");
if(rows.length)md+=mdTable(rows, [{key:"reviewer",label:"Reviewer"},{key:"reviewed",label:"Reviewed",align:"right",format:fmt}]);else md+="_No reviews._\n";return md;
}});

// C3
registerReport({id:"c3",suite:"C",title:"Submission Quality",etaSeconds:1,async run(){
let md=mdH2("C3: Submission Quality by Submitter");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(submitted_by,'anon') AS submitter, COUNT(*) AS total, COUNT(*)FILTER(WHERE status='approved') AS approved, COUNT(*)FILTER(WHERE status='rejected') AS rejected FROM moderation_queue GROUP BY submitted_by ORDER BY total DESC");
if(rows.length)md+=mdTable(rows.map(r=>({submitter:r.submitter,total:r.total,approved:r.approved,rejected:r.rejected,ar:r.total>0?(r.approved/r.total*100).toFixed(0)+"%":"-"})),[{key:"submitter",label:"Submitter"},{key:"total",label:"Total",align:"right",format:fmt},{key:"approved",label:"Approved",align:"right",format:fmt},{key:"rejected",label:"Rejected",align:"right",format:fmt},{key:"ar",label:"App%",align:"right"}]);return md;
}});

// C4
registerReport({id:"c4",suite:"C",title:"Safe Browsing",etaSeconds:1,async run(){
let md=mdH2("C4: Safe Browsing Failures");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const total=sqlGet("SELECT COUNT(*) AS cnt FROM moderation_queue").cnt;
const failed=sqlGet("SELECT COUNT(*) AS cnt FROM moderation_queue WHERE safe_browsing_passed=0").cnt;
md+=mdSummaryCards([{label:"Total Submissions",value:fmt(total)},{label:"Failed",value:fmt(failed)},{label:"Pass Rate",value:pct(total-failed,total)}]);return md;
}});

// D1
registerReport({id:"d1",suite:"D",title:"User Growth",etaSeconds:1,async run(){
let md=mdH2("D1: User Growth Trends");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT date(created_at) AS date, COUNT(*) AS count FROM profiles GROUP BY date ORDER BY date DESC LIMIT 30");
if(rows.length)md+=mdTable(rows, [{key:"date",label:"Date"},{key:"count",label:"Signups",align:"right",format:fmt}]);return md;
}});

// D2
registerReport({id:"d2",suite:"D",title:"Retention",etaSeconds:1,async run(){
let md=mdH2("D2: Retention Cohorts");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const total=sqlGet("SELECT COUNT(*) AS cnt FROM profiles").cnt;
const a1d=sqlGet("SELECT COUNT(DISTINCT user_id) AS cnt FROM seen_urls WHERE datetime(seen_at)>=datetime('now','-1 day')").cnt;
const a7d=sqlGet("SELECT COUNT(DISTINCT user_id) AS cnt FROM seen_urls WHERE datetime(seen_at)>=datetime('now','-7 days')").cnt;
md+=mdSummaryCards([{label:"Total Users",value:fmt(total)},{label:"Active 1d",value:fmt(a1d)},{label:"Active 7d",value:fmt(a7d)}]);return md;
}});

// D3
registerReport({id:"d3",suite:"D",title:"Dwell Distribution",etaSeconds:1,async run(){
let md=mdH2("D3: Dwell Time Distribution");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const q=s=>sqlGet(`SELECT COUNT(*) AS cnt FROM seen_urls WHERE dwell_ms${s}`).cnt;
const b=[{label:"<1s",cnt:q(">=0 AND dwell_ms<1000")},{label:"1-3s",cnt:q(">=1000 AND dwell_ms<3000")},{label:"3-10s",cnt:q(">=3000 AND dwell_ms<10000")},{label:"10-30s",cnt:q(">=10000 AND dwell_ms<30000")},{label:"30s-2m",cnt:q(">=30000 AND dwell_ms<120000")},{label:"2m+",cnt:q(">=120000")}];
if(b.length)md+=mdTable(b.map(r=>({bucket:r.label,count:r.cnt})),[{key:"bucket",label:"Duration"},{key:"count",label:"Events",align:"right",format:fmt}]);return md;
}});

// D4
registerReport({id:"d4",suite:"D",title:"Skip by Category",etaSeconds:1,async run(){
let md=mdH2("D4: Skip Rate by Category");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(c.name,'unknown') AS category, COUNT(*) AS seen, COUNT(*)FILTER(WHERE su.skipped=1) AS skipped FROM seen_urls su JOIN urls u ON u.id=su.url_id JOIN subcategories sc ON sc.id=u.subcategory_id JOIN categories c ON c.id=sc.category_id GROUP BY c.name ORDER BY seen DESC LIMIT 15");
if(rows.length)md+=mdTable(rows.map(r=>({category:r.category,seen:r.seen,skipped:r.skipped,pct:pct(r.skipped,r.seen)})),[{key:"category",label:"Category"},{key:"seen",label:"Seen",align:"right",format:fmt},{key:"skipped",label:"Skipped",align:"right",format:fmt},{key:"pct",label:"Skip%",align:"right"}]);return md;
}});

// D5
registerReport({id:"d5",suite:"D",title:"Power Users",etaSeconds:1,async run(){
let md=mdH2("D5: Power User Leaderboard");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(display_name,username,'?') AS name, COALESCE(level,1) AS level, COALESCE(xp_total,0) AS xp, COALESCE(badge_count,0) AS badges FROM profiles ORDER BY xp_total DESC LIMIT 30");
if(rows.length)md+=mdTable(rows, [{key:"name",label:"User"},{key:"level",label:"Lvl",align:"right",format:fmt},{key:"xp",label:"XP",align:"right",format:fmt},{key:"badges",label:"Badges",align:"right",format:fmt}]);return md;
}});

// D6
registerReport({id:"d6",suite:"D",title:"Interest Health",etaSeconds:1,async run(){
let md=mdH2("D6: Interest Calibration Health");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(s.name,'?') AS subcategory, AVG(uis.calibrated_weight) AS avg_weight, COUNT(*) AS users FROM user_interest_scores uis JOIN subcategories s ON s.id=uis.subcategory_id GROUP BY s.name ORDER BY avg_weight DESC");
const hot=rows.filter(r=>r.avg_weight>0.5).length,warm=rows.filter(r=>r.avg_weight>=0.2&&r.avg_weight<=0.5).length,cold=rows.filter(r=>r.avg_weight<0.2).length,t=rows.length;
md+=mdSummaryCards([{label:"Total Scores",value:fmt(t)},{label:"Hot (>0.5)",value:fmt(hot)},{label:"Warm (0.2-0.5)",value:fmt(warm)},{label:"Cold (<0.2)",value:fmt(cold)}]);return md;
}});

// E1
registerReport({id:"e1",suite:"E",title:"Badge Distribution",etaSeconds:1,async run(){
let md=mdH2("E1: Badge Distribution");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT b.name, COUNT(*) AS awarded FROM user_badges ub JOIN badges b ON b.id=ub.badge_id GROUP BY b.name ORDER BY awarded DESC");
if(rows.length)md+=mdTable(rows, [{key:"name",label:"Badge"},{key:"awarded",label:"Awarded",align:"right",format:fmt}]);return md;
}});

// E2
registerReport({id:"e2",suite:"E",title:"XP Economy",etaSeconds:1,async run(){
let md=mdH2("E2: XP Economy Report");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(action,'unknown') AS action, COUNT(*) AS events, SUM(xp_awarded) AS total_xp FROM xp_log GROUP BY action ORDER BY total_xp DESC");
if(rows.length)md+=mdTable(rows, [{key:"action",label:"Action"},{key:"events",label:"Events",align:"right",format:fmt},{key:"total_xp",label:"Total XP",align:"right",format:fmt}]);return md;
}});

// E3
registerReport({id:"e3",suite:"E",title:"Level Distribution",etaSeconds:1,async run(){
let md=mdH2("E3: Level Distribution");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const rows=sqlQuery("SELECT COALESCE(level,1) AS level, COUNT(*) AS users FROM profiles GROUP BY level ORDER BY level");
if(rows.length)md+=mdTable(rows, [{key:"level",label:"Level",align:"right",format:fmt},{key:"users",label:"Users",align:"right",format:fmt}]);return md;
}});

// E4
registerReport({id:"e4",suite:"E",title:"Streak Health",etaSeconds:1,async run(){
let md=mdH2("E4: Streak Health");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const active=sqlGet("SELECT COUNT(*) AS cnt FROM profiles WHERE streak_days>0").cnt;
const max=sqlGet("SELECT COALESCE(MAX(streak_days),0) AS cnt FROM profiles").cnt;
const total=sqlGet("SELECT COUNT(*) AS cnt FROM profiles").cnt;
md+=mdSummaryCards([{label:"Active Streaks",value:fmt(active)},{label:"Max Streak",value:fmt(max)},{label:"Total Users",value:fmt(total)}]);return md;
}});

// F1
registerReport({id:"f1",suite:"F",title:"Follow Graph",etaSeconds:1,async run(){
let md=mdH2("F1: Follow Graph Stats");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const total=sqlGet("SELECT COUNT(*) AS cnt FROM follows").cnt;
const unique=sqlGet("SELECT COUNT(DISTINCT following_id) AS cnt FROM follows").cnt;
md+=mdSummaryCards([{label:"Total Follows",value:fmt(total)},{label:"Unique Followed",value:fmt(unique)}]);return md;
}});

// F2
registerReport({id:"f2",suite:"F",title:"Activity Feed",etaSeconds:1,async run(){
let md=mdH2("F2: Activity Feed Health");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const total=sqlGet("SELECT COUNT(*) AS cnt FROM user_activity").cnt;
const recent=sqlGet("SELECT COUNT(*) AS cnt FROM user_activity WHERE datetime(created_at)>=datetime('now','-7 days')").cnt;
md+=mdSummaryCards([{label:"Total Posts",value:fmt(total)},{label:"Posts (7d)",value:fmt(recent)}]);return md;
}});

// F3
registerReport({id:"f3",suite:"F",title:"Sharing Stats",etaSeconds:1,async run(){
let md=mdH2("F3: URL Sharing Stats");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const shares=sqlGet("SELECT COUNT(*) AS cnt FROM shared_urls").cnt;
const saves=sqlGet("SELECT COUNT(*) AS cnt FROM saved_urls").cnt;
md+=mdSummaryCards([{label:"Total Shares",value:fmt(shares)},{label:"Total Saves",value:fmt(saves)}]);return md;
}});

// G1
registerReport({id:"g1",suite:"G",title:"Notification Delivery",etaSeconds:1,async run(){
let md=mdH2("G1: Notification Delivery Rate");if(!isOffline()){md+="_Online not implemented._\n";return md;}
const total=sqlGet("SELECT COUNT(*) AS cnt FROM notifications").cnt;
md+=mdSummaryCards([{label:"Total Notifications",value:fmt(total)}]);return md;
}});