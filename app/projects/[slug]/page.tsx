import ProjectDetail from "./project-detail";
import { requireTodakUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireTodakUser(`/projects/${slug}`);
  return <ProjectDetail slug={slug} />;
}
