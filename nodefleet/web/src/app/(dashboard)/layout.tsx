import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { redirect } from "next/navigation";

// Mock auth check - replace with actual auth() call
async function getSession() {
  // TODO: Implement actual auth check
  // const session = await auth();
  // if (!session) {
  //   redirect("/login");
  // }
  // return session;
  return { user: { id: "user-1", email: "user@example.com" } };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          {/* Header */}
          <Header />

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="lg:pl-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
