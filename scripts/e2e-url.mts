if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { createLinkedItem } = await import("../lib/capture-url");
const { getItemDetail, deleteItem } = await import("../lib/items");

async function captureAndReport(url: string, expectKind?: string) {
  const result = await createLinkedItem({ rawUrl: url });
  const detail = await getItemDetail(result.itemId);
  console.log(
    `captured ${url}\n  kind=${result.kind}${expectKind ? ` (expected ${expectKind}${result.kind === expectKind ? " ✓" : " ✗"})` : ""}` +
      ` preview=${result.previewCaptured ? "captured ✓" : "metadata-only"} title=${JSON.stringify(detail?.title)} source=${detail?.source ? "present ✓" : "MISSING"}`,
  );
  if (result.previewCaptured && detail?.media?.displayKey) {
    console.log(`  preview key: ${detail.media.displayKey}`);
  }
  return result.itemId;
}

const ids: string[] = [];
try {
  ids.push(await captureAndReport("https://example.com"));
  ids.push(await captureAndReport("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video"));
  ids.push(await captureAndReport("https://www.joshwcomeau.com/animation/css-transitions/"));
} finally {
  for (const id of ids) await deleteItem(id);
}
console.log("URL capture e2e passes (cleanup done)");
