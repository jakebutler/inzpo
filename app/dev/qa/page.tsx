import { notFound } from "next/navigation";
import { isFoldQaEnabled } from "@/lib/auth/dev-bypass";
import { QaStates } from "./QaStates";

export const dynamic = "force-dynamic";

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string; state?: string }>;
}) {
  if (!isFoldQaEnabled()) notFound();
  const params = await searchParams;
  return <QaStates issue={params.issue ?? "56"} state={params.state ?? "empty"} />;
}
