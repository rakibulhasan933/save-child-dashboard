import { LiveScreenViewer } from "@/components/live-screen-viewer";

export default async function ChildLiveScreenPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return <LiveScreenViewer childId={childId} />;
}
