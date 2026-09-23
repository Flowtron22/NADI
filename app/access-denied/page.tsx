import { LockKeyhole } from "lucide-react";
import { chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const user = await getChatGPTUser();
  return <main className="admin-denied">
    <LockKeyhole />
    <h1>TODAK account required</h1>
    <p>This dashboard is available only to verified <strong>@todak.com</strong> accounts.</p>
    {user?.email && <p>You are currently signed in as {user.email}.</p>}
    <a href={chatGPTSignOutPath("/")} target="_top">Sign in with a TODAK account</a>
  </main>;
}
