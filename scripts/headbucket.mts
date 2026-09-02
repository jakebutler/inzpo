if (!process.env.R2_ENDPOINT) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT!, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
for (const name of process.argv.slice(2)) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(name, "-> 200 EXISTS");
  } catch (e: any) {
    console.log(name, "->", e.$metadata?.httpStatusCode, e.name);
  }
}
