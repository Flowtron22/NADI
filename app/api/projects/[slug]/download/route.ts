import { getChatGPTUser, requireTodakApiUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { createRepositoryAdminAction } from "@/lib/project-data";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const user = await getChatGPTUser();
  if (!user || !isAdminEmail(user.email)) return Response.json({ error: "Only an approved dashboard administrator can access repository source." }, { status: 403 });
  try {
    const action = await createRepositoryAdminAction((await params).slug, { userId: user.userId, email: user.email });
    return Response.redirect(action.target, 302);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Repository access could not be prepared." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
