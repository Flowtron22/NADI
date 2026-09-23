import { requireTodakApiUser } from "@/app/chatgpt-auth";
import { getRepositorySnapshot } from "@/lib/project-data";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  try {
    const path = new URL(request.url).searchParams.get("path") || "";
    return Response.json({ repository: await getRepositorySnapshot((await params).slug, path) }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Repository could not be loaded." }, { status: 400 });
  }
}
