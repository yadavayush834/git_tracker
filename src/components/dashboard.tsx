"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  ExternalLink,
  Flame,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload, Repository, RepositoryStatus } from "@/lib/dashboard-data";

type View = "overview" | "projects" | "activity";
type Overrides = Record<number, RepositoryStatus>;

const statusStyles: Record<RepositoryStatus, string> = {
  "In progress": "status-blue",
  Started: "status-violet",
  Stale: "status-amber",
  Empty: "status-slate",
  Completed: "status-green",
  Maintained: "status-teal",
};

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

const allStatuses: RepositoryStatus[] = ["In progress", "Started", "Stale", "Empty", "Completed", "Maintained"];

function formatRelative(date: string | null) {
  if (!date) return "No commits yet";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 90) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86_400);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, image, small = false }: { name: string; image: string; small?: boolean }) {
  return (
    <div
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={image ? { backgroundImage: `url(${image})` } : undefined}
      role={image ? "img" : undefined}
      aria-label={image ? `${name}'s avatar` : undefined}
    >
      {!image && initials(name)}
    </div>
  );
}

function MetricCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number | string; note: string; tone: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}>
      <span>{value}%</span>
    </div>
  );
}

function ContributionGrid({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="contribution-wrap">
      <div className="month-labels"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div>
      <div className="contribution-grid" aria-label="Contribution activity for the last 13 weeks">
        {values.slice(-91).map((value, index) => {
          const level = value === 0 ? 0 : Math.max(1, Math.ceil((value / max) * 4));
          return <span key={index} className={`contribution level-${level}`} title={`${value} activities`} />;
        })}
      </div>
      <div className="legend"><span>Less</span>{[0,1,2,3,4].map((level) => <i key={level} className={`contribution level-${level}`} />)}<span>More</span></div>
    </div>
  );
}

function RepoRow({ repo, onStatusChange }: { repo: Repository; onStatusChange: (id: number, status: RepositoryStatus) => void }) {
  return (
    <article className="repo-row">
      <div className="repo-main">
        <div className="repo-icon"><BookOpen size={18} /></div>
        <div className="repo-copy">
          <div className="repo-title-line">
            <a href={repo.url} target="_blank" rel="noreferrer">{repo.name}<ExternalLink size={12} /></a>
            <span className="visibility">{repo.visibility}</span>
          </div>
          <p>{repo.description}</p>
          <div className="repo-meta">
            {repo.language && <span><i style={{ background: languageColors[repo.language] ?? "#8b5cf6" }} />{repo.language}</span>}
            {repo.stars > 0 && <span><Star size={13} />{repo.stars}</span>}
            {repo.forks > 0 && <span><GitBranch size={13} />{repo.forks}</span>}
            <span>Updated {formatRelative(repo.pushedAt)}</span>
          </div>
        </div>
      </div>
      <div className="repo-status">
        <label className={`status-select ${statusStyles[repo.status]}`}>
          <select value={repo.status} onChange={(event) => onStatusChange(repo.id, event.target.value as RepositoryStatus)} aria-label={`Status for ${repo.name}`}>
            {allStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
          <ChevronDown size={13} />
        </label>
        <ProgressRing value={repo.progress} />
        <a href={repo.url} target="_blank" rel="noreferrer" className="icon-button" aria-label={`Open ${repo.name}`}><ArrowRight size={17} /></a>
      </div>
    </article>
  );
}

export function Dashboard({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RepositoryStatus | "All">("All");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [renderedAt] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedData = localStorage.getItem("repo-pulse-data");
        const savedUser = localStorage.getItem("repo-pulse-username");
        const savedOverrides = localStorage.getItem("repo-pulse-overrides");
        if (savedData) setData(JSON.parse(savedData) as DashboardPayload);
        if (savedUser) setUsername(savedUser);
        if (savedOverrides) setOverrides(JSON.parse(savedOverrides) as Overrides);
      } catch { /* A corrupt local cache should not block the dashboard. */ }
      void fetch("/api/dashboard")
        .then(async (response) => {
          if (!response.ok) return;
          const storedData = await response.json() as DashboardPayload;
          setData(storedData);
          localStorage.setItem("repo-pulse-data", JSON.stringify(storedData));
        })
        .catch(() => { /* Demo and local data remain available if storage is offline. */ });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const repositories = useMemo(() => data.repositories.map((repo) => ({ ...repo, status: overrides[repo.id] ?? repo.status })), [data.repositories, overrides]);
  const counts = useMemo(() => ({
    total: repositories.length,
    active: repositories.filter((repo) => repo.status === "In progress" || repo.status === "Started").length,
    completed: repositories.filter((repo) => repo.status === "Completed" || repo.status === "Maintained").length,
    attention: repositories.filter((repo) => repo.status === "Stale" || repo.status === "Empty").length,
  }), [repositories]);
  const filteredRepos = repositories.filter((repo) => {
    const matchesText = `${repo.name} ${repo.description} ${repo.language ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (statusFilter === "All" || repo.status === statusFilter);
  });
  const todayActivity = data.activities.filter((item) => renderedAt - new Date(item.createdAt).getTime() < 86_400_000).length;
  const displayName = data.profile.name === "Your workspace" ? "builder" : data.profile.login;

  async function syncGithub(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/github/repositories?username=${encodeURIComponent(username.trim())}`);
      const payload = await response.json() as DashboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not sync GitHub.");
      setData(payload);
      localStorage.setItem("repo-pulse-data", JSON.stringify(payload));
      localStorage.setItem("repo-pulse-username", username.trim());
      setSyncOpen(false);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync GitHub.");
    } finally { setLoading(false); }
  }

  function updateStatus(id: number, status: RepositoryStatus) {
    const next = { ...overrides, [id]: status };
    setOverrides(next);
    localStorage.setItem("repo-pulse-overrides", JSON.stringify(next));
  }

  const nav = [
    { id: "overview" as const, label: "Overview", icon: <LayoutDashboard size={18} /> },
    { id: "projects" as const, label: "Repositories", icon: <Boxes size={18} />, badge: counts.total },
    { id: "activity" as const, label: "Activity", icon: <Activity size={18} /> },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><GitBranch size={20} /></div><span>Repo<span>Pulse</span></span></div>
        <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X /></button>
        <nav className="nav-list">
          <p>Workspace</p>
          {nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileMenu(false); }}>
            {item.icon}<span>{item.label}</span>{item.badge !== undefined && <b>{item.badge}</b>}
          </button>)}
          <p>Manage</p>
          <button onClick={() => { setView("projects"); setStatusFilter("Stale"); }}><AlertTriangle size={18} /><span>Needs attention</span>{counts.attention > 0 && <b className="warning-badge">{counts.attention}</b>}</button>
          <button onClick={() => setSyncOpen(true)}><RefreshCw size={18} /><span>Sync GitHub</span></button>
          <button><Settings size={18} /><span>Settings</span></button>
        </nav>
        <div className="sidebar-card"><Sparkles size={18} /><strong>Small steps, shipped.</strong><p>Your consistency is the real project.</p></div>
        <div className="sidebar-profile"><Avatar name={data.profile.name} image={data.profile.avatarUrl} small /><div><strong>{data.profile.name}</strong><span>@{data.profile.login}</span></div><MoreHorizontal size={18} /></div>
      </aside>

      {mobileMenu && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu /></button>
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{view === "projects" ? "Repositories" : view === "activity" ? "Activity" : "Overview"}</strong></div>
          <div className="top-actions"><span className="sync-note"><i />{data.source === "github" ? `Synced ${formatRelative(data.syncedAt)}` : "Demo data"}</span><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i className="notification-dot" /></button><button className="sync-button" onClick={() => setSyncOpen(true)}><Code2 size={17} />{data.source === "github" ? "Sync now" : "Connect GitHub"}</button></div>
        </header>

        <div className="page-wrap">
          {view === "overview" && <>
            <section className="welcome-row"><div><p className="eyebrow">{getGreeting()}</p><h1>Keep the momentum, {displayName}.</h1><p>Here’s what’s moving across your projects today.</p></div><div className="streak-pill"><Flame size={20} /><div><strong>7 day streak</strong><span>Best: 12 days</span></div></div></section>

            <section className="metrics-grid">
              <MetricCard icon={<Boxes size={20} />} label="Total repositories" value={counts.total} note="Across your GitHub" tone="tone-blue" />
              <MetricCard icon={<Rocket size={20} />} label="In motion" value={counts.active} note="Active or recently started" tone="tone-violet" />
              <MetricCard icon={<CheckCircle2 size={20} />} label="Completed" value={counts.completed} note="Shipped and maintained" tone="tone-green" />
              <MetricCard icon={<Target size={20} />} label="Today’s activity" value={todayActivity} note="Events in the last 24h" tone="tone-orange" />
            </section>

            <section className="dashboard-grid">
              <div className="panel contribution-panel"><div className="panel-heading"><div><h2>Contribution rhythm</h2><p>Your activity over the last 13 weeks</p></div><span className="activity-total"><strong>{data.contributions.reduce((sum, value) => sum + value, 0)}</strong> activities</span></div><ContributionGrid values={data.contributions} /></div>
              <div className="panel focus-panel"><div className="panel-heading"><div><h2>Focus score</h2><p>Projects moving forward</p></div></div><div className="focus-body"><div className="big-ring" style={{ "--progress": `${Math.min(100, Math.round((counts.active / Math.max(counts.total, 1)) * 100)) * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.min(100, Math.round((counts.active / Math.max(counts.total, 1)) * 100))}</strong><span>/100</span></div></div><div className="focus-copy"><strong>Good momentum</strong><p>Keep active projects limited and finish one before starting another.</p></div></div></div>
            </section>

            <section className="content-columns">
              <div className="panel repo-panel"><div className="panel-heading"><div><h2>Recently active</h2><p>The projects closest to your fingertips</p></div><button className="text-button" onClick={() => setView("projects")}>View all <ArrowRight size={15} /></button></div><div className="repo-list">{repositories.slice(0, 4).map((repo) => <RepoRow key={repo.id} repo={repo} onStatusChange={updateStatus} />)}</div></div>
              <aside className="panel attention-panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>A little cleanup goes a long way</p></div></div><div className="attention-list">
                <button onClick={() => { setView("projects"); setStatusFilter("Stale"); }}><div className="attention-icon amber"><AlertTriangle size={17} /></div><div><strong>{repositories.filter((r) => r.status === "Stale").length} stale projects</strong><span>No activity in 90+ days</span></div><ArrowRight size={16} /></button>
                <button onClick={() => { setView("projects"); setStatusFilter("Empty"); }}><div className="attention-icon gray"><CircleDot size={17} /></div><div><strong>{repositories.filter((r) => r.status === "Empty").length} empty repositories</strong><span>Ready to start or archive</span></div><ArrowRight size={16} /></button>
                <button onClick={() => setView("projects")}><div className="attention-icon blue"><Code2 size={17} /></div><div><strong>{repositories.filter((r) => !r.language).length} missing languages</strong><span>Add code or review setup</span></div><ArrowRight size={16} /></button>
              </div><div className="cleanup-tip"><Check size={17} /><p><strong>Weekly reset</strong>Review one old repository every Sunday.</p></div></aside>
            </section>
          </>}

          {view === "projects" && <section className="view-section"><div className="view-heading"><div><p className="eyebrow">Project library</p><h1>All repositories</h1><p>Review automatic suggestions and set the status that feels right.</p></div><button className="sync-button" onClick={() => setSyncOpen(true)}><RefreshCw size={17} />Sync GitHub</button></div><div className="panel filters"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories..." /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RepositoryStatus | "All")}><option>All</option>{allStatuses.map((status) => <option key={status}>{status}</option>)}</select><span>{filteredRepos.length} repositories</span></div><div className="panel repo-panel"><div className="repo-list">{filteredRepos.map((repo) => <RepoRow key={repo.id} repo={repo} onStatusChange={updateStatus} />)}{filteredRepos.length === 0 && <div className="empty-state"><Search size={24} /><strong>No matching repositories</strong><p>Try a different name or status.</p></div>}</div></div></section>}

          {view === "activity" && <section className="view-section"><div className="view-heading"><div><p className="eyebrow">Daily progress</p><h1>Activity stream</h1><p>Your pushes, pull requests, issues, and releases in one timeline.</p></div></div><div className="panel activity-view"><div className="panel-heading"><div><h2>Latest GitHub events</h2><p>{data.activities.length} recent activities found</p></div></div><div className="timeline">{data.activities.map((item) => <article key={item.id}><div className={`timeline-icon ${item.type}`}>{item.type === "push" ? <GitBranch size={16} /> : item.type === "pull_request" ? <GitPullRequest size={16} /> : item.type === "release" ? <Rocket size={16} /> : <CircleDot size={16} />}</div><div><span>{formatRelative(item.createdAt)}</span><strong>{item.title}</strong><p><b>{item.repo}</b> · {item.detail}</p></div></article>)}{data.activities.length === 0 && <div className="empty-state"><Activity size={24} /><strong>No recent public activity</strong><p>Private activity requires a server-side GitHub token.</p></div>}</div></div></section>}
        </div>
      </main>

      {syncOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSyncOpen(false)}><section className="sync-modal" role="dialog" aria-modal="true" aria-labelledby="sync-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSyncOpen(false)} aria-label="Close"><X size={18} /></button><div className="modal-icon"><Code2 size={24} /></div><h2 id="sync-title">Connect your GitHub</h2><p>Enter your username to import public repositories now. Add a server token later for private repositories.</p><form onSubmit={syncGithub}><label htmlFor="github-username">GitHub username</label><div className="username-field"><span>github.com/</span><input id="github-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your-username" autoFocus required /></div>{error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}<button className="modal-submit" disabled={loading}>{loading ? <><RefreshCw size={17} className="spin" />Syncing repositories…</> : <><Code2 size={17} />Import repositories</>}</button></form><small><Check size={13} />No credentials are stored in the browser.</small></section></div>}
    </div>
  );
}
