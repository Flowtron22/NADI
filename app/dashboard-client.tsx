"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bot, Clock3, FolderKanban, LayoutGrid, LogOut, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectView } from "@/lib/project-data";
import { getProjectBranding } from "@/lib/project-branding";

function relativeTime(value: string) {
  if (!value) return "Awaiting first sync";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export default function DashboardClient({ userEmail, signOutPath }: { userEmail: string; signOutPath: string }) {
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(new Date());

  async function load(checkRepository=false) {
    setLoading(true);
    try { const response = await fetch(`/api/projects${checkRepository?"?refresh=1":""}`, { cache: "no-store" }); const data = await response.json() as { projects: ProjectView[] }; setProjects(data.projects || []); setLastChecked(new Date()); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const attention = useMemo(() => projects.filter((project) => project.health !== "On track").length, [projects]);

  return <main className="app-shell">
    <aside className="side-rail">
      <a href="/" className="rail-logo" aria-label="TODAK STUDIOS home"><span>TS</span></a>
      <nav aria-label="Main navigation">
        <a href="/" className="rail-link active" title="Projects"><LayoutGrid /></a>
        <a href="/api/ai/projects" className="rail-link" title="AI feed"><Bot /></a>
      </nav>
      <a href="/admin" className="rail-link rail-bottom" title="Project setup"><Settings2 /></a>
    </aside>

    <section className="dashboard">
      <header className="dashboard-head">
        <div><img className="todak-logo" src="/todak-studios-logo.png" alt="TODAK STUDIOS"/></div>
        <div className="head-actions"><span className="signed-in-email">{userEmail}</span><Button variant="outline" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />Check for updates</Button><Button variant="ghost" asChild><a href={signOutPath} target="_top"><LogOut />Sign out</a></Button></div>
      </header>

      <div className="overview-strip">
        <div><span>Portfolio</span><strong>{projects.length}</strong><small>active projects</small></div>
        <div><span>Attention</span><strong className={attention ? "warn-text" : ""}>{attention}</strong><small>need a closer look</small></div>
        <div><span>Connection</span><strong className="status-word">Live</strong><small>Git + Plastic / API</small></div>
      </div>

      <div className="section-title"><div><h2>Projects</h2></div><span><Clock3 size={14} />Checked {relativeTime(lastChecked.toISOString())}</span></div>

      <div className="project-grid" aria-busy={loading}>
        {loading && !projects.length ? [0,1,2].map((item) => <div className="project-card skeleton-card" key={item} />) : projects.map((project) => {
          const branding = getProjectBranding(project.slug);
          return <a href={`/projects/${project.slug}`} className="project-card" key={project.slug} style={{ "--project-accent": project.accent } as React.CSSProperties}>
            <div className="project-card-top"><div className={branding?.logo ? "project-icon project-logo-frame" : "project-icon"}>{branding?.logo ? <img src={branding.logo} alt={`${project.name} logo`} /> : project.icon}</div><span className={`stage stage-${project.stage.toLowerCase().replaceAll(" ", "-")}`}>{project.stage}</span></div>
            <div className="project-copy"><p>{project.repositoryHost} · {project.branch}</p><h3>{project.name}</h3><span>{project.description}</span></div>
            <div className="project-summary">{project.summary}</div>
            <div className="project-focus"><span>Next objective</span><strong>{project.focus}</strong></div>
            <footer><span><span className="avatar-mini">{project.lastAuthor.slice(0,1)}</span>{project.lastAuthor}</span><span>{relativeTime(project.lastSyncedAt)}<ArrowUpRight size={15} /></span></footer>
          </a>})}
      </div>

      {!loading && !projects.length && <div className="empty-projects"><FolderKanban /><h2>No projects connected</h2><p>Add the first repository from Project setup.</p><Button asChild><a href="/admin">Open project setup</a></Button></div>}
    </section>
  </main>;
}
