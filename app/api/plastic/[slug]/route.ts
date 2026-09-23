import { ingestPlasticUpdate } from "@/lib/project-data";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authorization = request.headers.get("authorization") || "";
  const secret = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!secret) return Response.json({ error: "Add the Plastic bridge secret." }, { status: 401 });
  try {
    const result = await ingestPlasticUpdate((await params).slug, secret, await request.json() as Record<string, unknown>);
    return Response.json({ changed: result.changed, updatedAt: result.project?.lastSyncedAt || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Plastic update could not be accepted.";
    const status = /not accepted/i.test(message) ? 401 : /not found/i.test(message) ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
