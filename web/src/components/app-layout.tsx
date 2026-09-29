import { Navigate, Outlet } from "react-router";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackWidget } from "@/components/feedback-widget";
import { authClient } from "@/lib/auth-client";

export function AppLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <FeedbackWidget />
    </SidebarProvider>
  );
}

// 管理者以外が開いたらホームへ戻す
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  if (session?.user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
