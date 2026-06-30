import { LiveScreenViewer } from "@/components/live-screen-viewer";
import { cookies } from "next/headers";



export default async function ChildLiveScreenPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  console.log("Token in live-screen/page.tsx:", token);

  return <LiveScreenViewer childId={childId} adminToken={token || ""} />;
}
