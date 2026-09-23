import { NextRequest, NextResponse } from "next/server";
import { requireTodakApiUser } from "@/app/chatgpt-auth";

type Payload = { source?: string; repository?: string; token?: string; branch?: string; path?: string };
function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function safePart(value: string) { return encodeURIComponent(value.replace(/^\/+|\/+$/g, "")); }
function gitParts(url: URL) { return url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/").filter(Boolean); }

async function providerRequest(input: Required<Payload>) {
  const repo = new URL(input.repository);
  const parts = gitParts(repo);
  const file = input.path.replace(/^\//, "") || "updates.md";
  const branch = input.branch || "main";
  let target = "";
  let headers: Record<string, string> = { accept: "text/plain, application/json" };
  if (repo.hostname === "github.com") {
    if (parts.length < 2) throw new Error("That GitHub repository link is incomplete.");
    target = `https://api.github.com/repos/${safePart(parts[0])}/${safePart(parts[1])}/contents/${file.split("/").map(safePart).join("/")}?ref=${encodeURIComponent(branch)}`;
    headers = { ...headers, authorization: `Bearer ${input.token}`, accept: "application/vnd.github.raw+json", "user-agent": "handoff-reader" };
  } else if (repo.hostname.includes("gitlab")) {
    target = `${repo.origin}/api/v4/projects/${encodeURIComponent(parts.join("/"))}/repository/files/${encodeURIComponent(file)}/raw?ref=${encodeURIComponent(branch)}`;
    headers["private-token"] = input.token;
  } else if (repo.hostname === "bitbucket.org") {
    if (parts.length < 2) throw new Error("That Bitbucket repository link is incomplete.");
    target = `https://api.bitbucket.org/2.0/repositories/${safePart(parts[0])}/${safePart(parts[1])}/src/${safePart(branch)}/${file.split("/").map(safePart).join("/")}`;
    headers.authorization = `Bearer ${input.token}`;
  } else if (repo.hostname === "dev.azure.com") {
    const gitIndex = parts.indexOf("_git");
    if (gitIndex < 2 || !parts[gitIndex + 1]) throw new Error("That Azure DevOps repository link is incomplete.");
    const [org, project] = parts;
    target = `https://dev.azure.com/${safePart(org)}/${safePart(project)}/_apis/git/repositories/${safePart(parts[gitIndex + 1])}/items?path=${encodeURIComponent("/" + file)}&versionDescriptor.version=${encodeURIComponent(branch)}&includeContent=true&api-version=7.1`;
    headers.authorization = `Basic ${btoa(`:${input.token}`)}`;
  } else throw new Error("Use a GitHub, GitLab, Bitbucket, or Azure DevOps link. For another system, choose Plastic / API.");
  return fetch(target, { headers, redirect: "follow" });
}

function validateApiUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("The API address must begin with https://");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error("Use an internet-accessible HTTPS API address.");
  return url;
}

export async function POST(request: NextRequest) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  let input: Payload;
  try { input = await request.json(); } catch { return error("The request was not valid."); }
  const normalized: Required<Payload> = { source: input.source || "git", repository: input.repository?.trim() || "", token: input.token?.trim() || "", branch: input.branch?.trim() || "main", path: input.path?.trim() || "updates.md" };
  if (!normalized.repository || !normalized.token) return error("Add the repository or API address and its read-only access key.");
  try {
    const upstream = normalized.source === "api" ? await fetch(validateApiUrl(normalized.repository), { headers: { authorization: `Bearer ${normalized.token}`, accept: "text/markdown, text/plain, application/json" }, redirect: "follow" }) : await providerRequest(normalized);
    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) return error("The access key was not accepted. Check that it has read permission.", 401);
      if (upstream.status === 404) return error("The repository or update file was not found. Check the link, branch, and file name.", 404);
      return error(`The source returned an error (${upstream.status}).`, 502);
    }
    const contentType = upstream.headers.get("content-type") || "";
    let content = "";
    if (contentType.includes("application/json")) {
      const data = await upstream.json() as Record<string, unknown>;
      const candidate = data.content ?? data.handoff ?? data.markdown ?? data.text;
      if (typeof candidate !== "string") return error("The API returned JSON, but no content, handoff, markdown, or text field was found.", 422);
      content = candidate;
    } else content = await upstream.text();
    if (!content.trim()) return error("The update file is empty.", 422);
    if (content.length > 750_000) return error("The update file is too large to display safely.", 413);
    return NextResponse.json({ content, sourceLabel: normalized.source === "api" ? "API handoff" : new URL(normalized.repository).hostname, branch: normalized.source === "git" ? normalized.branch : undefined, path: normalized.source === "git" ? normalized.path : "API response", updatedAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) });
  } catch (cause) { return error(cause instanceof Error ? cause.message : "The handoff could not be read.", 400); }
}
