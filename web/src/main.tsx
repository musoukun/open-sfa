import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminOnly, AppLayout } from "@/components/app-layout";
import { LoginPage, SetupPage } from "@/pages/auth-pages";
import { DashboardPage } from "@/pages/dashboard";
import { DealsPage } from "@/pages/deals";
import { DealDetailPage } from "@/pages/deal-detail";
import { NewQuotePage, QuoteDetailPage, QuotesPage } from "@/pages/quotes";
import { CustomerDetailPage, CustomersPage } from "@/pages/customers";
import { MembersPage } from "@/pages/members";
import { AdminAccountsPage } from "@/pages/admin-accounts";
import { SettingsPage } from "@/pages/settings";
import { InsightsPage } from "@/pages/insights";
import { ForgotPasswordPage, ResetPasswordPage } from "@/pages/password-pages";
import { SignupPage } from "@/pages/signup";
import { InvitationsPage } from "@/pages/invitations";
import { DealOverviewPage } from "@/pages/deal-overview";
import { MeetingDetailPage, MeetingsPage, NewMeetingPage } from "@/pages/meetings";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/setup", element: <SetupPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "deals", element: <DealsPage /> },
      { path: "deals/:id", element: <DealDetailPage /> },
      { path: "deals/:id/overview", element: <DealOverviewPage /> },
      { path: "deals/:id/meetings/new", element: <NewMeetingPage /> },
      { path: "meetings", element: <MeetingsPage /> },
      { path: "meetings/:id", element: <MeetingDetailPage /> },
      { path: "quotes", element: <QuotesPage /> },
      { path: "quotes/new", element: <NewQuotePage /> },
      { path: "quotes/:id", element: <QuoteDetailPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "insights", element: <InsightsPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "invitations", element: <InvitationsPage /> },
      { path: "settings", element: <SettingsPage /> },
      {
        path: "admin/accounts",
        element: (
          <AdminOnly>
            <AdminAccountsPage />
          </AdminOnly>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
