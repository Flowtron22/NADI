import { ArrowLeft, LockKeyhole } from "lucide-react";
import { chatGPTSignOutPath, requireTodakUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/admin-auth";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireTodakUser("/admin");
  if (!isAdminEmail(user.email)) return <main className="admin-denied"><LockKeyhole/><h1>Project setup is restricted</h1><p>Signed in as {user.email}. Only an approved dashboard administrator can change repository connections.</p><a href={chatGPTSignOutPath("/admin")} target="_top">Sign in with another account</a></main>;
  return <AdminClient userEmail={user.email}/>;
}
