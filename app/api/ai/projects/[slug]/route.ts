import { requireTodakApiUser } from "@/app/chatgpt-auth";
import { getProject } from "@/lib/project-data";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const project = await getProject((await params).slug);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json({ generatedAt: new Date().toISOString(), project, suggestedQuestions: ["What changed since the previous handoff?", "What needs leadership attention?", "What are the next three actions?"] });
}
