import { getChatGPTUser, requireTodakApiUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { listProjectConnections } from "@/lib/project-data";

export async function GET() {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to manage projects." }, { status: 401 });
  if (!isAdminEmail(user.email)) return Response.json({ error: "Only an approved dashboard administrator can manage projects." }, { status: 403 });
  return Response.json({ projects: await listProjectConnections() });
}
