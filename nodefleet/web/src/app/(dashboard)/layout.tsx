import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={session.user} />

        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header />

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
