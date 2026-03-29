import { AdminSidebar } from "@/components/platform-admin/sidebar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { platformAdmins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check platform_admin role — either user.role === 'admin' or in platformAdmins table
  const isAdmin = (session.user as any).userRole === "admin";
  if (!isAdmin) {
    const [adminRecord] = await db
      .select()
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, session.user.id))
      .limit(1);

    if (!adminRecord) {
      redirect("/");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar user={session.user} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Admin header bar */}
          <div className="h-12 border-b border-red-900/30 bg-red-950/20 flex items-center px-6">
            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
              Platform Administration
            </span>
          </div>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
