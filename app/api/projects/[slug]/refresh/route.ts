import { requireTodakApiUser } from "@/app/chatgpt-auth";
import { syncProject } from "@/lib/project-data";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  try { return Response.json(await syncProject((await params).slug)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Refresh failed." }, { status: 400 }); }
}
