import { getChatGPTUser, requireTodakApiUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { listProjects, saveProject, syncAllProjects } from "@/lib/project-data";

export async function GET(request: Request) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  if (new URL(request.url).searchParams.get("refresh") === "1") await syncAllProjects(true);
  return Response.json({ projects: await listProjects(), refreshedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage projects." }, { status: 401 });
  if (!isAdminEmail(user.email)) return Response.json({ error: "Only an approved dashboard administrator can manage projects." }, { status: 403 });
  try { const project = await saveProject(await request.json() as Record<string, unknown>); return Response.json({ project }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Project could not be saved." }, { status: 400 }); }
}
