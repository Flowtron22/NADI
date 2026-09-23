import { registerPlasticBridge } from "@/lib/project-data";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const secret = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!secret) return Response.json({ error: "Add the Plastic bridge secret." }, { status: 401 });
  try {
    const result = await registerPlasticBridge((await params).slug, secret, await request.json() as Record<string, unknown>);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Plastic bridge could not be registered.";
    const status = /not accepted/i.test(message) ? 401 : /not found/i.test(message) ? 404 : 400;
    return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
