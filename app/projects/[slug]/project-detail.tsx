"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Bot, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, Download, File, FileText, Flag, Folder, GitBranch, GitCommit, History, Layers3, LockKeyhole, RefreshCw, Settings2, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectView, RepositorySnapshot } from "@/lib/project-data";
import { getProjectBranding } from "@/lib/project-branding";

function Markdown({ source }: { source: string }) {
  const lines = useMemo(() => source.replace(/<!--[^]*?-->/g, "").replace(/\r/g, "").split("\n"), [source]);
  const inline = (text: string): ReactNode[] => text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("`") ? <code key={index}>{part.slice(1,-1)}</code> : part.startsWith("**") ? <strong key={index}>{part.slice(2,-2)}</strong> : part);
  return <div className="markdown">{lines.map((line,index) => {
    if (!line.trim()) return <div className="md-space" key={index}/>;
    if (line.startsWith("### ")) return <h3 key={index}>{inline(line.slice(4))}</h3>;
    if (line.startsWith("## ")) return <h2 key={index}>{inline(line.slice(3))}</h2>;
    if (line.startsWith("# ")) return <h1 key={index}>{inline(line.slice(2))}</h1>;
    if (/^[-*] /.test(line)) return <div className="md-list" key={index}><Check size={15}/><p>{inline(line.slice(2))}</p></div>;
    if (line.startsWith("> ")) return <blockquote key={index}>{inline(line.slice(2))}</blockquote>;
    return <p key={index}>{inline(line)}</p>;
  })}</div>;
}

function relativeTime(value: string) { if (!value) return "Awaiting sync"; const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} minutes ago` : `${Math.round(minutes/60)} hours ago`; }
function fileSize(value: number|null) { if (value===null) return "Folder"; if(value<1024)return `${value} B`; if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`; return `${(value/1024/1024).toFixed(1)} MB`; }

function managementSections(source: string) {
  const sections = new Map<string,string>(); let heading = ""; let lines: string[] = [];
  const save = () => { if (heading) sections.set(heading, lines.join("\n").trim()); };
  for (const line of source.replace(/\r/g, "").split("\n")) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) { save(); heading = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); lines = []; }
    else if (heading) lines.push(line);
  }
  save(); return sections;
}
function listLines(value: string) { return value.split("\n").map((line)=>line.trim()).filter((line)=>/^[-*]\s+/.test(line)).map((line)=>line.replace(/^[-*]\s+/,"").replace(/\*\*/g,"").slice(0,220)).slice(0,4); }
const MANAGEMENT_FIELDS = ["project stage","delivery health","status","current milestone","target date","main outcome","next objective","key risk","leadership attention","owner"] as const;
function managementBrief(source: string) {
  const fields = new Map<string,string>();
  const lines=source.replace(/\r/g,"").split("\n");
  const start=lines.findIndex((line)=>/^##\s+Management Brief\s*$/i.test(line.trim()));
  if(start<0)return fields;
  for(const line of lines.slice(start+1)) {
    if(/^#{1,2}\s+/.test(line.trim()))break;
    const normalized=line.trim().replace(/^[-*]\s*/,"").replace(/\*\*/g,"");
    const separator=normalized.indexOf(":");
    if(separator<0)continue;
    const key=normalized.slice(0,separator).trim().toLowerCase();
    const value=normalized.slice(separator+1).trim().slice(0,260);
    if((MANAGEMENT_FIELDS as readonly string[]).includes(key)&&value)fields.set(key,value);
  }
  return fields;
}
function reported(value: string|undefined) { return value?.trim()||"Not provided"; }
function needsAttention(value: string) { return !/^\s*(not provided|none|n\/a|no (active )?(risk|decision|attention)( requested| required| recorded)?\.?|no blockers?\.?)\s*$/i.test(value); }
function classifyWork(message: string) {
  const value=message.toLowerCase();
  if (/\b(fix|bug|issue|error|crash|broken|regression)\b/.test(value)) return "Bug fixing";
  if (/\b(ui|ux|hud|menu|widget|screen|interface)\b/.test(value)) return "UI / UX";
  if (/\b(art|map|level|material|texture|asset|vfx|lighting|mesh|animation)\b/.test(value)) return "Art / Map";
  if (/\b(build|package|pipeline|network|server|performance|memory|compile|config|plugin)\b/.test(value)) return "Tech / Build";
  return "Gameplay";
}
function executiveReadout(project: ProjectView, repository: RepositorySnapshot|null) {
  const primary=project.documents.find((item)=>item.path.toLowerCase()==="updates.md")||project.documents[0];
  const sections=managementSections(primary?.content||"");
  const brief=managementBrief(primary?.content||"");
  const summary=reported(brief.get("main outcome"));
  const stage=reported(brief.get("project stage")||project.stage);
  const confidence=reported(brief.get("delivery health")||brief.get("status"));
  const milestone=reported(brief.get("current milestone"));
  const targetDate=reported(brief.get("target date"));
  const nextObjective=reported(brief.get("next objective"));
  const owner=reported(brief.get("owner"));
  const risk=reported(brief.get("key risk"));
  const attention=reported(brief.get("leadership attention"));
  const outcomesText=sections.get("recent outcomes")||"";
  const outcomes=listLines(outcomesText); if(!outcomes.length&&needsAttention(summary))outcomes.push(summary);
  const blockers=needsAttention(risk)?[risk]:[];
  const decisions=needsAttention(attention)?[attention]:[];
  const commits=repository?.activity||repository?.commits||[];
  const categories=["Gameplay","UI / UX","Art / Map","Tech / Build","Bug fixing"].map((name)=>({name,count:commits.filter((item)=>classifyWork(item.message)===name).length})).filter((item)=>item.count>0);
  const maxCategory=Math.max(1,...categories.map((item)=>item.count));
  const now=Date.now();
  const momentum=[3,2,1,0].map((weeksAgo)=>{const start=now-(weeksAgo+1)*7*86400000;const end=now-weeksAgo*7*86400000;return commits.filter((item)=>{const date=new Date(item.date).getTime();return Number.isFinite(date)&&date>=start&&date<end;}).length;});
  return {summary,stage,confidence,milestone,targetDate,nextObjective,owner,outcomes,blockers,decisions,categories,maxCategory,momentum,activityCount:commits.length};
}

export default function ProjectDetail({ slug }: { slug: string }) {
  const [project,setProject] = useState<ProjectView|null>(null); const [active,setActive] = useState(""); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [canAccessRepositorySource,setCanAccessRepositorySource] = useState(false);
  const [view,setView] = useState<"overview"|"updates"|"repository">("overview"); const [repository,setRepository] = useState<RepositorySnapshot|null>(null); const [repositoryLoading,setRepositoryLoading] = useState(false); const [repositoryError,setRepositoryError] = useState("");
  async function load(refresh=false) { setLoading(true); setError(""); try { const response=await fetch(`/api/projects/${slug}${refresh?"?refresh=1":""}`,{cache:"no-store"}); const data=await response.json() as {project?:ProjectView;permissions?:{canAccessRepositorySource?:boolean};error?:string}; if(!response.ok||!data.project) throw new Error(data.error||"Project could not be loaded."); setProject(data.project); setCanAccessRepositorySource(Boolean(data.permissions?.canAccessRepositorySource)); setActive((current)=>current||data.project!.documents[0]?.path||""); } catch(cause){setError(cause instanceof Error?cause.message:"Project could not be loaded.");} finally{setLoading(false);} }
  async function loadRepository(path="") { setRepositoryLoading(true); setRepositoryError(""); try { const response=await fetch(`/api/projects/${slug}/repository${path?`?path=${encodeURIComponent(path)}`:""}`,{cache:"no-store"}); const data=await response.json() as {repository?:RepositorySnapshot;error?:string}; if(!response.ok||!data.repository)throw new Error(data.error||"Repository could not be loaded."); setRepository(data.repository); } catch(cause){setRepositoryError(cause instanceof Error?cause.message:"Repository could not be loaded.");} finally{setRepositoryLoading(false);} }
  useEffect(()=>{void load();},[slug]);
  useEffect(()=>{if((view==="overview"||view==="repository")&&!repository&&!repositoryLoading)void loadRepository();},[view]);
  const document=project?.documents.find((item)=>item.path===active)||project?.documents[0];
  if (!project && loading) return <main className="detail-loading"><Activity className="spin"/><span>Opening project briefing…</span></main>;
  if (!project) return <main className="detail-loading"><p>{error}</p><Button asChild><a href="/">Return to projects</a></Button></main>;
  const branding=getProjectBranding(project.slug);
  const executive=executiveReadout(project,repository);
  const momentumMax=Math.max(1,...executive.momentum);
  return <main className="detail-shell" style={{"--project-accent":project.accent,"--project-banner-image":branding?.banner?`url(${branding.banner})`:"none","--project-banner-position":branding?.bannerPosition??"center"} as React.CSSProperties}>
    <header className="detail-topbar"><a href="/" className="back-link"><ArrowLeft/>All projects</a><div className="detail-brand"><img src="/todak-studios-logo.png" alt="TODAK STUDIOS"/></div><div className="detail-actions"><a href={`/api/ai/projects/${project.slug}`}><Bot/>AI feed</a><a href="/admin"><Settings2/>Setup</a></div></header>
    <section className={branding?.banner?"project-banner has-project-banner":"project-banner"}>
      <div className={branding?.logo?"large-project-icon detail-project-logo":"large-project-icon"}>{branding?.logo?<img src={branding.logo} alt={`${project.name} logo`}/>:project.icon}</div><div className="banner-copy"><div className="repo-line"><span className={`stage stage-${executive.stage.toLowerCase().replaceAll(" ","-")}`}>{executive.stage}</span><span><GitBranch/>{project.repositoryHost} · {project.branch}</span></div><h1>{project.name}</h1><p>{project.description}</p></div>
      <div className="banner-sync"><span><span className="pulse-dot"/>Repository connection</span><p><Clock3/>Updated {relativeTime(project.lastSyncedAt)}</p><Button variant="outline" onClick={()=>void load(true)} disabled={loading}><RefreshCw className={loading?"spin":""}/>Check updates.md</Button></div>
    </section>
    <nav className="project-tabs" aria-label="Project views"><button className={view==="overview"?"active":""} onClick={()=>setView("overview")}><Layers3/>Overview</button><button className={view==="updates"?"active":""} onClick={()=>setView("updates")}><FileText/>Updates</button><button className={view==="repository"?"active":""} onClick={()=>setView("repository")}><Folder/>Repository</button></nav>
    {view==="overview"?<section className="executive-overview">
      <div className="executive-headline">
        <div><span className="executive-kicker">Management brief</span><h2>{executive.summary}</h2><p><strong>Next objective:</strong> {executive.nextObjective}</p></div>
        <aside className={executive.decisions.length?"attention-callout has-decision":"attention-callout"}><CircleAlert/><div><span>Leadership attention</span><strong>{executive.decisions[0]||"No leadership action is currently requested."}</strong><small>Owner: {executive.owner}</small></div></aside>
      </div>
      <div className="executive-signals">
        <article><ShieldCheck/><span>Delivery health</span><strong className={`confidence-${executive.confidence.toLowerCase().replaceAll(" ","-")}`}>{executive.confidence}</strong><small>Team-reported in Management Brief</small></article>
        <article><Flag/><span>Current milestone</span><strong>{executive.milestone}</strong><small>Target: {executive.targetDate}</small></article>
        <article><CircleAlert/><span>Open attention items</span><strong>{executive.blockers.length+executive.decisions.length}</strong><small>{executive.blockers.length} risks · {executive.decisions.length} leadership requests</small></article>
        <article><Clock3/><span>Data freshness</span><strong>{relativeTime(project.lastSyncedAt)}</strong><small>{project.lastRevision}</small></article>
      </div>
      <div className="executive-grid">
        <article className="executive-panel momentum-panel"><header><div><Activity/><span><strong>Delivery momentum</strong><small>Repository activity, not a productivity score</small></span></div><em>{executive.activityCount} recent changes</em></header>
          <div className="momentum-chart" aria-label={`Recent weekly change activity: ${executive.momentum.join(", ")}`}>
            {executive.momentum.map((count,index)=><div className="momentum-week" key={index}><span className="momentum-value">{count}</span><div><i style={{height:`${Math.max(8,count/momentumMax*100)}%`}}/></div><small>{index===3?"This week":`${3-index}w ago`}</small></div>)}
          </div>
          {repositoryLoading?<p className="metric-note"><Activity className="spin"/>Reading recent repository activity…</p>:repositoryError?<p className="metric-note">Activity is temporarily unavailable; the Updates and Repository views are unaffected.</p>:<p className="metric-note">Calculated from the recent history currently available to the dashboard.</p>}
        </article>
        <article className="executive-panel"><header><div><Target/><span><strong>Current work mix</strong><small>Estimated from recent change comments</small></span></div></header>
          <div className="work-mix">{executive.categories.length?executive.categories.map((item)=><div className="work-mix-row" key={item.name}><span>{item.name}</span><div><i style={{width:`${Math.max(10,item.count/executive.maxCategory*100)}%`}}/></div><strong>{item.count}</strong></div>):<div className="executive-empty">Work mix will appear when recent repository activity is available.</div>}</div>
        </article>
        <article className="executive-panel"><header><div><Check/><span><strong>Recent outcomes</strong><small>Completed work, not raw commits</small></span></div></header>
          {executive.outcomes.length?<ul className="outcome-list">{executive.outcomes.map((item,index)=><li key={index}><Check/>{item}</li>)}</ul>:<div className="executive-empty">Main outcome: Not provided.</div>}
        </article>
        <article className="executive-panel"><header><div><CalendarDays/><span><strong>Leadership attention</strong><small>Blockers, risks, and requested decisions</small></span></div></header>
          {executive.blockers.length||executive.decisions.length?<div className="attention-list">{executive.decisions.map((item,index)=><div key={`decision-${index}`}><span className="attention-type decision">Attention</span><p>{item}</p></div>)}{executive.blockers.map((item,index)=><div key={`blocker-${index}`}><span className="attention-type blocker">Risk</span><p>{item}</p></div>)}</div>:<div className="executive-empty">No risk or leadership request is recorded in the Management Brief.</div>}
        </article>
      </div>
      <p className="executive-disclaimer">Repository activity and work mix are generated automatically. Project stage, delivery health, milestone, target date, outcome, objective, risk, leadership attention, and owner are read only from the structured Management Brief in updates.md.</p>
    </section>:view==="updates"?<section className="brief-grid">
      <aside className="brief-sidebar">
        <div className="brief-card"><span>Main outcome</span><p>{executive.summary}</p></div>
        <div className="brief-card"><span>Next objective</span><strong>{executive.nextObjective}</strong></div>
        <div className="source-card"><ShieldCheck/><div><strong>Verified source</strong><span>{project.lastAuthor} · {project.lastRevision}</span></div></div>
        <nav className="document-nav" aria-label="Project documents"><span>Repository documents</span>{project.documents.map((item)=><button key={item.path} className={document?.path===item.path?"active":""} onClick={()=>setActive(item.path)}><FileText/>{item.path}</button>)}</nav>
      </aside>
      <article className="document-panel">
        <header><div><FileText/><span>{document?.path||"No document"}</span></div><small>Synced from repository</small></header>
        <div className="document-paper">{document?<Markdown source={document.content}/>:<div className="no-document"><FileText/><h2>No Markdown has been synced yet</h2><p>Check the repository connection in Project setup.</p></div>}</div>
      </article>
    </section>:<section className="repository-browser">
      <div className="readonly-banner"><div><LockKeyhole/><span><strong>Read-only repository view</strong><small>Browse files and recent activity. Nothing here can change the repository.</small></span></div>{canAccessRepositorySource?<a className="repository-source-action" href={`/api/projects/${project.slug}/download`} onClick={(event)=>{if(!window.confirm("Download this confidential project source as a ZIP?"))event.preventDefault();}}><Download/>Download ZIP</a>:<span>VIEW ONLY</span>}</div>
      <div className="repository-toolbar"><div className="branch-chip"><GitBranch/>{repository?.branch||project.branch}</div><div className="repo-breadcrumbs"><button onClick={()=>void loadRepository("")}>{project.name}</button>{repository?.path.split("/").filter(Boolean).map((part,index)=>{const path=repository.path.split("/").slice(0,index+1).join("/");return <span key={path}><ChevronRight/><button onClick={()=>void loadRepository(path)}>{part}</button></span>})}</div><button className="repo-refresh" onClick={()=>void loadRepository(repository?.path||"")} disabled={repositoryLoading}><RefreshCw className={repositoryLoading?"spin":""}/>Refresh view</button></div>
      {repositoryError?<div className="repository-error">{repositoryError}</div>:<div className="repository-grid">
        <div className="repository-tree">
          <header><div>{repository?.commits[0]?<><GitCommit/><strong>{repository.commits[0].author}</strong><span>{repository.commits[0].message}</span></>:<><Folder/><strong>Repository root</strong><span>Read-only listing</span></>}</div><small>{repository?.commits[0]?.id||repository?.provider||""}</small></header>
          {repositoryLoading&&!repository?<div className="repository-empty"><Activity className="spin"/>Loading repository…</div>:repository?.entries.length?repository.entries.map((entry)=>entry.type==="dir"?<button className="repository-row" key={entry.path} onClick={()=>void loadRepository(entry.path)}><Folder/><strong>{entry.name}</strong><span>Folder</span><ChevronRight/></button>:<div className="repository-row" key={entry.path}><File/><strong>{entry.name}</strong><span>{fileSize(entry.size)}</span><i>Read only</i></div>):<div className="repository-empty"><Folder/><strong>No items available</strong><span>{repository?.note||"The repository index has not been received yet."}</span></div>}
          {repository?.note&&repository.entries.length>0?<p className="repository-note">{repository.note}</p>:null}
        </div>
        <aside className="commit-list"><header><History/><div><strong>Recent activity</strong><span>{repository?.provider||project.repositoryHost}</span></div></header>{repository?.commits.length?repository.commits.map((commit)=><div className="commit-item" key={`${commit.id}-${commit.date}`}><GitCommit/><div><strong>{commit.message}</strong><span>{commit.author} · {relativeTime(commit.date)}</span></div><code>{commit.id}</code></div>):<div className="commit-empty">Recent changes will appear after the next repository sync.</div>}</aside>
      </div>}
    </section>}
  </main>;
}
