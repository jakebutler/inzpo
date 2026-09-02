import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await db.execute(sql`select count(*)::int as items from items`);
  const itemCount = (result.rows[0] as { items: number }).items;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Inzpo</h1>
        <p className="mt-2 text-neutral-400">
          Walking skeleton — app is live and connected to Neon.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4 max-w-sm">
          <dt className="text-neutral-400">Items</dt>
          <dd className="font-mono">{itemCount}</dd>
          <dt className="text-neutral-400">Database</dt>
          <dd className="font-mono text-emerald-400">connected</dd>
        </dl>
      </div>
    </main>
  );
}
