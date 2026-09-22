import { AiCoachPanel } from "@/components/ai/AiCoachPanel";
import { DashboardShell } from "@/components/DashboardShell";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "AI Coach",
  description:
    "Live AI coaching for your Edge Log journal, edge, and process.",
  path: "/coach",
  index: false,
});

export default function CoachPage() {
  return (
    <DashboardShell
      title="AI Coach"
      description="Streaming insights from your journal, this page, and your process"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <AiCoachPanel variant="page" />
      </div>
    </DashboardShell>
  );
}
