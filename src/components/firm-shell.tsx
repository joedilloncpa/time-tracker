import { UserContext } from "@/lib/types";
import { TopMenu } from "@/components/top-menu";

export function FirmShell({
  activeTimer,
  firmSlug,
  user,
  timerClients,
  children
}: {
  activeTimer: {
    id: string;
    startedAt: string;
  } | null;
  firmSlug: string;
  user: UserContext;
  timerClients: Array<{
    id: string;
    name: string;
    code?: string | null;
    workstreams: Array<{
      id: string;
      name: string;
    }>;
  }>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <TopMenu activeTimer={activeTimer} firmSlug={firmSlug} timerClients={timerClients} user={user} />
      <div className="cb-shell px-0 py-4">
        <section>{children}</section>
      </div>
    </div>
  );
}
