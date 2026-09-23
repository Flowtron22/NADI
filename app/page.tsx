import { chatGPTSignOutPath, requireTodakUser } from "@/app/chatgpt-auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireTodakUser("/");
  return <DashboardClient userEmail={user.email} signOutPath={chatGPTSignOutPath("/")} />;
}
