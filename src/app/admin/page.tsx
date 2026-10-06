import { redirect } from "next/navigation";
import { hasAdminSession } from "../../lib/adminAuth";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  // Belt and suspenders: proxy.ts already gates this route, but the page
  // checks the session itself too in case routing ever changes.
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}
