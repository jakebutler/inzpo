if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

import { r2, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "../lib/r2";

const client = r2();
let bucket = process.env.R2_BUCKET;
if (!bucket) {
  const buckets = await client.send(new ListBucketsCommand({}));
  const names = (buckets.Buckets ?? []).map((b) => b.Name);
  console.log("buckets:", names);
  if (names.length !== 1) {
    console.error("Expected exactly one bucket; set R2_BUCKET manually if ambiguous");
    process.exit(1);
  }
  bucket = names[0];
}
console.log("R2_BUCKET=" + bucket);

const key = `smoke/${Date.now()}.txt`;
const body = `inzpo r2 smoke ${new Date().toISOString()}`;
await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }));
const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
const text = await got.Body!.transformToString("utf8");
if (text !== body) throw new Error("roundtrip mismatch");
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log("R2 smoke: write/read/delete OK");
