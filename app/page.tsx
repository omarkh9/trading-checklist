import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { DashboardShell } from "@/components/DashboardShell";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata } from "@/lib/site";
import { getAuthUser } from "@/lib/supabase/server";

export const metadata = pageMetadata({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

export default async function HomePage() {
  const user = await getAuthUser();

  if (user) {
    return (
      <DashboardShell
        title="Dashboard"
        description="Live balance, net P/L, and the setups that moved the account"
      >
        <DashboardHome />
      </DashboardShell>
    );
  }

  return <LandingPage />;
}
