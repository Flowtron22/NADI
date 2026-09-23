import { getChatGPTUser, requireTodakApiUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { getProject, removeProject, syncProject, updateProject } from "@/lib/project-data";

async function isOwner() { const user = await getChatGPTUser(); return Boolean(user && isAdminEmail(user.email)); }

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const { slug } = await params;
  if (new URL(request.url).searchParams.get("refresh") === "1") { try { await syncProject(slug); } catch { /* Return the last good snapshot. */ } }
  const project = await getProject(slug);
  return project ? Response.json({ project, permissions: { canAccessRepositorySource: await isOwner() } }) : Response.json({ error: "Project not found." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  if (!await isOwner()) return Response.json({ error: "Only the dashboard owner can edit projects." }, { status: 403 });
  try { return Response.json({ project: await updateProject((await params).slug, await request.json() as Record<string, unknown>) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Project could not be updated." }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  if (!await isOwner()) return Response.json({ error: "Only the dashboard owner can remove projects." }, { status: 403 });
  try { return Response.json(await removeProject((await params).slug)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Project could not be removed." }, { status: 400 }); }
}
