import { env } from "cloudflare:workers";

export type ProjectDocument = { path: string; content: string; fetchedAt: string };
export type RepositoryEntry = { name: string; path: string; type: "file" | "dir"; size: number | null };
export type RepositoryCommit = { id: string; message: string; author: string; date: string };
export type RepositorySnapshot = { branch: string; path: string; entries: RepositoryEntry[]; commits: RepositoryCommit[]; activity?: RepositoryCommit[]; updatedAt: string; provider: string; note?: string };
export type ProjectStage = "Pre-production" | "In development" | "On hold" | "Completed" | "Released" | "Cancelled";
export type DeliveryHealth = "On track" | "At risk" | "Needs attention";
export type ProjectView = {
  id: number | string; slug: string; name: string; description: string; icon: string; accent: string;
  sourceType: string; repositoryHost: string; branch: string; stage: ProjectStage; health: DeliveryHealth;
  lastSyncedAt: string; lastAuthor: string; lastRevision: string; summary: string; focus: string; documents: ProjectDocument[]; isDemo?: boolean;
};

type ProjectRow = {
  id: number; slug: string; name: string; description: string; icon: string; accent: string; source_type: string;
  repository_url: string; branch: string; document_paths: string; encrypted_token: string | null; token_iv: string | null;
  last_synced_at: string | null; last_revision: string | null; last_author: string | null;
};

const demoProjects: ProjectView[] = [
  {
    id: "demo-orbit", slug: "orbit-mobile", name: "Orbit Mobile", icon: "O", accent: "#ffb75f", sourceType: "git", repositoryHost: "github.com", branch: "main", stage: "In development", health: "On track",
    description: "Mobile companion app for field teams", lastSyncedAt: new Date(Date.now() - 7 * 60_000).toISOString(), lastAuthor: "Aina Rahman", lastRevision: "a14c9e2", summary: "Release candidate is stable. The team is closing the final offline-sync test cases.", focus: "Release candidate validation",
    documents: [
      { path: "handoff.md", fetchedAt: new Date(Date.now() - 7 * 60_000).toISOString(), content: "# Orbit Mobile — Handoff\n\n## Executive summary\n\nRelease candidate 2 is stable on iOS and Android. Offline sync recovery passed the latest field test.\n\n## Current focus\n\nRelease candidate validation and closing the final six offline-sync test cases.\n\n## Completed\n\n- Authentication refresh flow shipped\n- Field media compression reduced upload time by 31%\n- Crash-free sessions reached 99.6%\n\n## Next\n\n- Complete offline conflict testing\n- Submit release candidate for stakeholder review\n- Prepare store release notes\n\n## Blockers\n\nNo active blockers." },
      { path: "decisions.md", fetchedAt: new Date(Date.now() - 20 * 60_000).toISOString(), content: "# Decisions\n\n## Offline queue\n\nKeep the current queue implementation for this release. Revisit background uploads after production telemetry is available." },
    ],
  },
  {
    id: "demo-arc", slug: "arc-platform", name: "Arc Platform", icon: "A", accent: "#6fd4c5", sourceType: "git", repositoryHost: "gitlab.com", branch: "release/2.4", stage: "In development", health: "At risk",
    description: "Shared services and internal operations platform", lastSyncedAt: new Date(Date.now() - 24 * 60_000).toISOString(), lastAuthor: "Daniel Lee", lastRevision: "7bd2f81", summary: "Migration work is progressing, but the reporting service remains above its latency target.", focus: "Database migration and reporting performance",
    documents: [{ path: "handoff.md", fetchedAt: new Date(Date.now() - 24 * 60_000).toISOString(), content: "# Arc Platform — Handoff\n\n## Executive summary\n\nThe database migration is 82% complete. Reporting latency improved, but remains above the agreed target.\n\n## Current focus\n\nComplete tenant migration and bring reporting p95 below 800ms.\n\n## Progress\n\n- 41 of 50 tenants migrated\n- Read replica enabled for reporting\n- Deployment rollback tested successfully\n\n## Risks\n\nReporting queries may delay the release if the remaining index work does not meet the performance target.\n\n## Decision needed\n\nApprove a 48-hour release buffer if p95 remains above 800ms on Friday." }],
  },
  {
    id: "demo-forge", slug: "forge-toolkit", name: "Forge Toolkit", icon: "F", accent: "#8ba8ff", sourceType: "api", repositoryHost: "Plastic / API", branch: "/main", stage: "In development", health: "Needs attention",
    description: "Production tools for the content team", lastSyncedAt: new Date(Date.now() - 52 * 60_000).toISOString(), lastAuthor: "Mira Hassan", lastRevision: "cs:1842", summary: "The export pipeline is blocked by a licensing issue on two build machines.", focus: "Restore automated exports",
    documents: [{ path: "handoff.md", fetchedAt: new Date(Date.now() - 52 * 60_000).toISOString(), content: "# Forge Toolkit — Handoff\n\n## Executive summary\n\nThe new batch exporter passed functional testing, but automated exports are stopped on two build machines.\n\n## Current focus\n\nRestore automated exports and finish the artist pilot.\n\n## Completed\n\n- Batch naming rules approved\n- Unreal import preset validated\n- Pilot documentation drafted\n\n## Blockers\n\nLicense activation is failing on BUILD-03 and BUILD-04. Infrastructure assistance is required.\n\n## Owner\n\nMira — coordinating with Infrastructure." }],
  },
];

const repositorySnapshotPath = ".__repository__.json";

function hostLabel(value: string, sourceType?: string) { if (sourceType === "plastic") return "Unity Version Control"; try { return new URL(value).hostname; } catch { return "Repository"; } }
function parsePaths(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : ["updates.md"]; } catch { return ["updates.md"]; } }
const briefFields = ["project stage", "delivery health", "status", "current milestone", "target date", "main outcome", "next objective", "key risk", "leadership attention", "owner"];
function managementBrief(content: string) {
  const fields = new Map<string,string>();
  const lines = content.replace(/\r/g, "").split("\n");
  const start = lines.findIndex((line) => /^##\s+Management Brief\s*$/i.test(line.trim()));
  if (start < 0) return fields;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s+/.test(line.trim())) break;
    const normalized = line.trim().replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
    const separator = normalized.indexOf(":");
    if (separator < 0) continue;
    const key = normalized.slice(0, separator).trim().toLowerCase();
    const value = normalized.slice(separator + 1).trim().slice(0, 260);
    if (briefFields.includes(key) && value) fields.set(key, value);
  }
  return fields;
}
function projectStage(value: string | undefined): ProjectStage {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "pre-production" || normalized === "pre production") return "Pre-production";
  if (normalized === "on hold" || normalized === "paused" || normalized === "pause") return "On hold";
  if (normalized === "completed" || normalized === "complete") return "Completed";
  if (normalized === "released" || normalized === "release" || normalized === "live") return "Released";
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "cancel") return "Cancelled";
  return "In development";
}
function deliveryHealth(value: string | undefined): DeliveryHealth {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "on track") return "On track";
  if (normalized === "at risk") return "At risk";
  return "Needs attention";
}

async function rowsToProject(row: ProjectRow, includeDocuments=true): Promise<ProjectView> {
  const documents = env.DB && includeDocuments ? (await env.DB.prepare("SELECT path, content, fetched_at AS fetchedAt FROM project_documents WHERE project_id = ? AND path != ? ORDER BY path").bind(row.id, repositorySnapshotPath).all<ProjectDocument>()).results : [];
  const primaryDocument = includeDocuments ? documents.find((doc) => doc.path.toLowerCase() === "updates.md") || documents[0] : env.DB ? await env.DB.prepare("SELECT path, substr(content,1,12000) AS content, fetched_at AS fetchedAt FROM project_documents WHERE project_id = ? AND path != ? ORDER BY CASE WHEN lower(path) = 'updates.md' THEN 0 ELSE 1 END, path LIMIT 1").bind(row.id, repositorySnapshotPath).first<ProjectDocument>() : null;
  const brief = managementBrief(primaryDocument?.content || "");
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, icon: row.icon, accent: row.accent, sourceType: row.source_type, repositoryHost: hostLabel(row.repository_url, row.source_type), branch: row.branch, stage: projectStage(brief.get("project stage")), health: deliveryHealth(brief.get("delivery health") || brief.get("status")), lastSyncedAt: row.last_synced_at || "", lastAuthor: row.last_author || "Repository", lastRevision: row.last_revision || row.branch, summary: brief.get("main outcome") || "Not provided", focus: brief.get("next objective") || "Not provided", documents };
}

export async function listProjects(includeDocuments=false): Promise<ProjectView[]> {
  if (!env.DB) return demoProjects;
  const rows = (await env.DB.prepare("SELECT * FROM projects ORDER BY updated_at DESC, id DESC").all<ProjectRow>()).results;
  if (!rows.length) return demoProjects;
  return Promise.all(rows.map((row) => rowsToProject(row, includeDocuments)));
}

export async function syncAllProjects(force=false) {
  if (!env.DB) return;
  const rows = (await env.DB.prepare("SELECT slug, last_synced_at FROM projects WHERE source_type != 'plastic' ORDER BY updated_at DESC LIMIT 12").all<{ slug: string; last_synced_at: string | null }>()).results;
  const stale = force ? rows : rows.filter((row) => !row.last_synced_at);
  await Promise.allSettled(stale.map((row) => syncProject(row.slug)));
}

export async function getProject(slug: string): Promise<ProjectView | null> {
  if (env.DB) {
    const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
    if (row) return rowsToProject(row);
  }
  return demoProjects.find((project) => project.slug === slug) || null;
}

function bytesToBase64(bytes: Uint8Array) { let value = ""; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); }
function bytesToBase64Url(bytes: Uint8Array) { return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function encryptionKey() {
  if (!env.REPO_ENCRYPTION_KEY) throw new Error("Repository encryption is not configured.");
  return crypto.subtle.importKey("raw", base64ToBytes(env.REPO_ENCRYPTION_KEY), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(token)); return { encrypted: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) }; }
async function decryptToken(encrypted: string, iv: string) { const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(encrypted)); return new TextDecoder().decode(clear); }

export async function saveProject(payload: Record<string, unknown>) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const name = String(payload.name || "").trim();
  const repositoryUrl = String(payload.repositoryUrl || "").trim();
  const token = String(payload.token || "").trim();
  if (!name || !repositoryUrl || !token) throw new Error("Project name, repository link, and access key are required.");
  const slug = String(payload.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54);
  const secured = await encryptToken(token);
  const paths = String(payload.documentPaths || "updates.md").split(",").map((path) => path.trim()).filter(Boolean).slice(0, 8);
  await env.DB.prepare(`INSERT INTO projects (slug,name,description,icon,accent,source_type,repository_url,branch,document_paths,encrypted_token,token_iv,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,icon=excluded.icon,accent=excluded.accent,source_type=excluded.source_type,repository_url=excluded.repository_url,branch=excluded.branch,document_paths=excluded.document_paths,encrypted_token=excluded.encrypted_token,token_iv=excluded.token_iv,updated_at=CURRENT_TIMESTAMP`)
    .bind(slug, name, String(payload.description || ""), String(payload.icon || name[0] || "◆").slice(0, 3), String(payload.accent || "#f4b860"), String(payload.sourceType || "git"), repositoryUrl, String(payload.branch || "main"), JSON.stringify(paths), secured.encrypted, secured.iv).run();
  if (String(payload.sourceType || "git") !== "plastic") await syncProject(slug);
  return getProject(slug);
}

export async function listProjectConnections() {
  if (!env.DB) return [];
  const rows = (await env.DB.prepare("SELECT slug,name,description,icon,accent,source_type AS sourceType,repository_url AS repositoryUrl,branch,document_paths AS documentPaths,last_synced_at AS lastSyncedAt FROM projects ORDER BY updated_at DESC").all<Record<string, unknown>>()).results;
  return rows.map((row) => ({ ...row, documentPaths: parsePaths(String(row.documentPaths || "[]")).join(",") }));
}

export async function updateProject(slug: string, payload: Record<string, unknown>) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row) throw new Error("Project not found.");
  const token = String(payload.token || "").trim();
  const secured = token ? await encryptToken(token) : { encrypted: row.encrypted_token, iv: row.token_iv };
  const paths = String(payload.documentPaths || parsePaths(row.document_paths).join(",")).split(",").map((path) => path.trim()).filter(Boolean).slice(0, 8);
  await env.DB.prepare(`UPDATE projects SET name=?,description=?,icon=?,accent=?,source_type=?,repository_url=?,branch=?,document_paths=?,encrypted_token=?,token_iv=?,updated_at=CURRENT_TIMESTAMP WHERE slug=?`)
    .bind(String(payload.name || row.name).trim(), String(payload.description ?? row.description), String(payload.icon || row.icon).slice(0, 3), String(payload.accent || row.accent), String(payload.sourceType || row.source_type), String(payload.repositoryUrl || row.repository_url).trim(), String(payload.branch || row.branch), JSON.stringify(paths), secured.encrypted, secured.iv, slug).run();
  if (String(payload.sourceType || row.source_type) !== "plastic") await syncProject(slug);
  return getProject(slug);
}

export async function removeProject(slug: string) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const result = await env.DB.prepare("DELETE FROM projects WHERE slug = ?").bind(slug).run();
  if (!result.meta.changes) throw new Error("Project not found.");
  return { removed: true, slug };
}

function safePart(value: string) { return encodeURIComponent(value.replace(/^\/+|\/+$/g, "")); }
async function readFile(row: ProjectRow, token: string, path: string) {
  if (row.source_type === "api") {
    const url = new URL(row.repository_url);
    if (url.protocol !== "https:") throw new Error("API links must use HTTPS.");
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "text/markdown,text/plain,application/json" }, redirect: "error" });
    if (!response.ok) throw new Error(`API returned ${response.status}.`);
    if ((response.headers.get("content-type") || "").includes("json")) { const data = await response.json() as Record<string, unknown>; const value = data[path] ?? data.content ?? data.handoff ?? data.markdown ?? data.text; if (typeof value !== "string") throw new Error("API response has no readable Markdown field."); return value; }
    return response.text();
  }
  const repo = new URL(row.repository_url); const parts = repo.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/").filter(Boolean); const branch = row.branch || "main";
  let target = ""; let headers: Record<string, string> = { accept: "text/plain" };
  if (repo.hostname === "github.com") { target = `https://api.github.com/repos/${safePart(parts[0])}/${safePart(parts[1])}/contents/${path.split("/").map(safePart).join("/")}?ref=${encodeURIComponent(branch)}`; headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github.raw+json", "user-agent": "project-pulse" }; }
  else if (repo.hostname.includes("gitlab")) { target = `${repo.origin}/api/v4/projects/${encodeURIComponent(parts.join("/"))}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`; headers["private-token"] = token; }
  else if (repo.hostname === "bitbucket.org") { target = `https://api.bitbucket.org/2.0/repositories/${safePart(parts[0])}/${safePart(parts[1])}/src/${safePart(branch)}/${path.split("/").map(safePart).join("/")}`; headers.authorization = `Bearer ${token}`; }
  else if (repo.hostname === "dev.azure.com") { const index = parts.indexOf("_git"); target = `https://dev.azure.com/${safePart(parts[0])}/${safePart(parts[1])}/_apis/git/repositories/${safePart(parts[index + 1])}/items?path=${encodeURIComponent("/" + path)}&versionDescriptor.version=${encodeURIComponent(branch)}&includeContent=true&api-version=7.1`; headers.authorization = `Basic ${btoa(`:${token}`)}`; }
  else throw new Error("Unsupported Git host. Use GitHub, GitLab, Bitbucket, Azure DevOps, or the API option.");
  const response = await fetch(target, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  return response.text();
}

function safeRepositoryPath(value: string) {
  const path = value.replace(/^\/+|\/+$/g, "");
  if (path.length > 500 || path.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("That repository path is not available.");
  return path;
}

async function githubRepositorySnapshot(row: ProjectRow, token: string, path: string): Promise<RepositorySnapshot> {
  const repo = new URL(row.repository_url); const parts = repo.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/").filter(Boolean);
  if (repo.hostname !== "github.com" || parts.length < 2) throw new Error("Repository browsing is currently available for GitHub and Plastic projects.");
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "todak-studios-project-viewer", "x-github-api-version": "2022-11-28" };
  const encodedPath = path ? `/${path.split("/").map(safePart).join("/")}` : "";
  const contentsUrl = `https://api.github.com/repos/${safePart(parts[0])}/${safePart(parts[1])}/contents${encodedPath}?ref=${encodeURIComponent(row.branch || "main")}`;
  const commitsUrl = `https://api.github.com/repos/${safePart(parts[0])}/${safePart(parts[1])}/commits?sha=${encodeURIComponent(row.branch || "main")}&per_page=100`;
  const [contentsResponse, commitsResponse] = await Promise.all([fetch(contentsUrl, { headers }), fetch(commitsUrl, { headers })]);
  if (!contentsResponse.ok) throw new Error(`Repository browser returned ${contentsResponse.status}.`);
  const rawEntries = await contentsResponse.json() as Array<{ name: string; path: string; type: string; size?: number }>;
  if (!Array.isArray(rawEntries)) throw new Error("This path is a file, not a folder.");
  const entries = rawEntries.filter((item) => item.type === "file" || item.type === "dir").map((item) => ({ name: item.name, path: item.path, type: item.type as "file" | "dir", size: item.type === "file" ? Number(item.size || 0) : null })).sort((a,b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1).slice(0, 300);
  let commits: RepositoryCommit[] = []; let activity: RepositoryCommit[] = [];
  if (commitsResponse.ok) {
    const rawCommits = await commitsResponse.json() as Array<{ sha: string; commit?: { message?: string; author?: { name?: string; date?: string } }; author?: { login?: string } }>;
    activity = rawCommits.map((item) => ({ id: item.sha.slice(0, 7), message: String(item.commit?.message || "No commit message").split("\n")[0].slice(0, 240), author: item.author?.login || item.commit?.author?.name || "Repository contributor", date: item.commit?.author?.date || "" }));
    commits = activity.slice(0, 10);
  }
  return { branch: row.branch || "main", path, entries, commits, activity, updatedAt: new Date().toISOString(), provider: "GitHub", note: rawEntries.length > 300 ? "Showing the first 300 items in this folder." : undefined };
}

export async function getRepositorySnapshot(slug: string, requestedPath=""): Promise<RepositorySnapshot> {
  if (!env.DB) throw new Error("Repository browsing is unavailable in demo mode.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row || !row.encrypted_token || !row.token_iv) throw new Error("Project connection is incomplete.");
  const path = requestedPath ? safeRepositoryPath(requestedPath) : "";
  if (row.source_type === "plastic") {
    const saved = await env.DB.prepare("SELECT content FROM project_documents WHERE project_id = ? AND path = ? LIMIT 1").bind(row.id, repositorySnapshotPath).first<{ content: string }>();
    if (!saved) return { branch: row.branch, path: "", entries: [], commits: [], updatedAt: row.last_synced_at || "", provider: "Unity Version Control", note: "The read-only repository index will appear after the next Plastic bridge update." };
    const snapshot = JSON.parse(saved.content) as RepositorySnapshot;
    return { ...snapshot, branch: row.branch, path: "", provider: "Unity Version Control", note: path ? "Plastic browsing currently shows the repository root." : snapshot.note };
  }
  return githubRepositorySnapshot(row, await decryptToken(row.encrypted_token, row.token_iv), path);
}

export async function createRepositoryAdminAction(slug: string, user: { userId: string; email: string }) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row || !row.encrypted_token || !row.token_iv) throw new Error("Project connection is incomplete.");
  const recent = await env.DB.prepare("SELECT id FROM repository_access_events WHERE user_id = ? AND project_id = ? AND created_at >= datetime('now','-1 minute') LIMIT 1").bind(user.userId, row.id).first<{ id: number }>();
  if (recent) throw new Error("Please wait one minute before requesting this repository again.");

  let action = "download_zip";
  let target = "";
  if (row.source_type === "git") {
    const repo = new URL(row.repository_url);
    const parts = repo.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/").filter(Boolean);
    if (repo.hostname !== "github.com" || parts.length < 2) throw new Error("ZIP downloads are currently available only for GitHub projects.");
    const token = await decryptToken(row.encrypted_token, row.token_iv);
    const response = await fetch(`https://api.github.com/repos/${safePart(parts[0])}/${safePart(parts[1])}/zipball/${encodeURIComponent(row.branch || "main")}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "todak-studios-project-viewer", "x-github-api-version": "2022-11-28" },
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (response.status !== 302 || !location) throw new Error(`GitHub archive request returned ${response.status}.`);
    const archiveUrl = new URL(location);
    const trustedArchiveHost = archiveUrl.hostname === "github.com" || archiveUrl.hostname.endsWith(".github.com") || archiveUrl.hostname.endsWith(".githubusercontent.com");
    if (archiveUrl.protocol !== "https:" || !trustedArchiveHost) throw new Error("GitHub returned an unexpected archive address.");
    target = archiveUrl.toString();
  } else if (row.source_type === "plastic") {
    const bridge = await env.DB.prepare("SELECT public_url FROM repository_bridges WHERE project_id = ? AND last_seen_at >= datetime('now','-2 minutes') LIMIT 1").bind(row.id).first<{ public_url: string }>();
    if (!bridge) throw new Error("The Plastic download bridge is offline. Switch on the bridge PC and try again in a minute.");
    const bridgeUrl = new URL(bridge.public_url);
    if (bridgeUrl.protocol !== "https:" || !bridgeUrl.hostname.endsWith(".trycloudflare.com")) throw new Error("The Plastic download bridge address is not trusted.");
    const secret = await decryptToken(row.encrypted_token, row.token_iv);
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ slug: row.slug, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID(), user: user.userId })));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
    const downloadUrl = new URL("/prepare", bridgeUrl);
    downloadUrl.searchParams.set("ticket", `${payload}.${signature}`);
    target = downloadUrl.toString();
  } else {
    throw new Error("Repository downloads are not available for this connection type.");
  }

  await env.DB.prepare("INSERT INTO repository_access_events (project_id,user_id,user_email,action,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)").bind(row.id, user.userId, user.email, action).run();
  return { target, action };
}

export async function registerPlasticBridge(slug: string, secret: string, payload: Record<string, unknown>) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row || row.source_type !== "plastic" || !row.encrypted_token || !row.token_iv) throw new Error("Plastic project not found.");
  if (!secret || !await secretMatches(secret, await decryptToken(row.encrypted_token, row.token_iv))) throw new Error("The bridge secret was not accepted.");
  const publicUrl = new URL(String(payload.url || ""));
  if (publicUrl.protocol !== "https:" || !publicUrl.hostname.endsWith(".trycloudflare.com") || publicUrl.pathname !== "/") throw new Error("The bridge URL is not accepted.");
  await env.DB.prepare(`INSERT INTO repository_bridges (project_id,public_url,last_seen_at) VALUES (?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET public_url=excluded.public_url,last_seen_at=CURRENT_TIMESTAMP`).bind(row.id, publicUrl.origin).run();
  return { connected: true, url: publicUrl.origin };
}

export async function syncProject(slug: string) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row || !row.encrypted_token || !row.token_iv) throw new Error("Project connection is incomplete.");
  if (row.source_type === "plastic") return { project: await getProject(slug), documentsUpdated: 0 };
  const token = await decryptToken(row.encrypted_token, row.token_iv); const paths = parsePaths(row.document_paths); const primaryPath = paths[0] || "updates.md"; let saved = 0;
  for (const path of paths) {
    try {
      const content = await readFile(row, token, path); const hash = bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))));
      const existing = await env.DB.prepare("SELECT content_hash FROM project_documents WHERE project_id = ? AND path = ? LIMIT 1").bind(row.id, path).first<{ content_hash: string }>();
      if (existing?.content_hash === hash) continue;
      await env.DB.prepare(`INSERT INTO project_documents (project_id,path,content,content_hash,fetched_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(project_id,path) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,fetched_at=CURRENT_TIMESTAMP`).bind(row.id, path, content.slice(0, 750_000), hash).run(); saved++;
    } catch (error) { if (path === primaryPath) throw error; }
  }
  if (saved > 0) await env.DB.prepare("UPDATE projects SET last_synced_at=CURRENT_TIMESTAMP,last_revision=?,last_author=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.branch, "Repository", row.id).run();
  return { project: await getProject(slug), documentsUpdated: saved };
}

async function secretMatches(actual: string, expected: string) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const [left, right] = await Promise.all([crypto.subtle.digest("SHA-256", encode(actual)), crypto.subtle.digest("SHA-256", encode(expected))]);
  const a = new Uint8Array(left); const b = new Uint8Array(right); let mismatch = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index++) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

export async function ingestPlasticUpdate(slug: string, secret: string, payload: Record<string, unknown>) {
  if (!env.DB) throw new Error("Project storage is unavailable.");
  const row = await env.DB.prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1").bind(slug).first<ProjectRow>();
  if (!row || row.source_type !== "plastic" || !row.encrypted_token || !row.token_iv) throw new Error("Plastic project not found.");
  if (!secret || !await secretMatches(secret, await decryptToken(row.encrypted_token, row.token_iv))) throw new Error("The bridge secret was not accepted.");
  const paths = parsePaths(row.document_paths); const path = String(payload.path || paths[0] || "updates.md").trim();
  if (!paths.includes(path)) throw new Error("That update file is not configured for this project.");
  const content = String(payload.content || "");
  if (!content.trim()) throw new Error("The update file is empty.");
  if (content.length > 750_000) throw new Error("The update file is too large.");
  const hash = bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))));
  const existing = await env.DB.prepare("SELECT content_hash FROM project_documents WHERE project_id = ? AND path = ? LIMIT 1").bind(row.id, path).first<{ content_hash: string }>();
  let changed = existing?.content_hash !== hash;
  if (changed) await env.DB.prepare(`INSERT INTO project_documents (project_id,path,content,content_hash,fetched_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(project_id,path) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,fetched_at=CURRENT_TIMESTAMP`).bind(row.id, path, content, hash).run();
  if (payload.repository && typeof payload.repository === "object") {
    const repositoryContent = JSON.stringify(payload.repository);
    if (repositoryContent.length > 500_000) throw new Error("The repository index is too large.");
    const repositoryHash = bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(repositoryContent))));
    const savedRepository = await env.DB.prepare("SELECT content_hash FROM project_documents WHERE project_id = ? AND path = ? LIMIT 1").bind(row.id, repositorySnapshotPath).first<{ content_hash: string }>();
    if (savedRepository?.content_hash !== repositoryHash) {
      await env.DB.prepare(`INSERT INTO project_documents (project_id,path,content,content_hash,fetched_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(project_id,path) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,fetched_at=CURRENT_TIMESTAMP`).bind(row.id, repositorySnapshotPath, repositoryContent, repositoryHash).run();
      changed = true;
    }
  }
  if (!changed) return { changed: false, project: await getProject(slug) };
  await env.DB.prepare("UPDATE projects SET last_synced_at=CURRENT_TIMESTAMP,last_revision=?,last_author=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(String(payload.revision || row.branch).slice(0, 120), String(payload.author || "Plastic bridge").slice(0, 120), row.id).run();
  return { changed, project: await getProject(slug) };
}
