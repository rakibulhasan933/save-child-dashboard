import { ChildDetail } from "@/components/child-detail";
import { cookies } from "next/headers";

export default async function ChildDetailPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
   const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  return <ChildDetail childId={childId} adminToken={token || ""} />;
}
