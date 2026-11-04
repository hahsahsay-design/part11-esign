import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { ROLE_LABELS } from "@/lib/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await requireAuthenticatedContext();

  return (
    <div className="flex min-h-screen bg-muted">
      <DashboardSidebar orgName={membership.organization.name} />
      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardTopbar userName={user.fullName} roleLabel={ROLE_LABELS[membership.role]} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
