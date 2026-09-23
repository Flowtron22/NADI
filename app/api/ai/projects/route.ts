import { requireTodakApiUser } from "@/app/chatgpt-auth";
import { listProjects } from "@/lib/project-data";

export async function GET() {
  const authError = await requireTodakApiUser();
  if (authError) return authError;
  const projects = await listProjects(true);
  return Response.json({ generatedAt: new Date().toISOString(), instructions: "Use this feed to brief the project lead. Prioritize projects marked Needs attention, then At risk.", projects: projects.map(({ documents, ...project }) => ({ ...project, documentCount: documents.length, documents: documents.map((doc) => ({ path: doc.path, fetchedAt: doc.fetchedAt })) })) });
}
