if (!process.env.R2_BUCKET) {
  const fs = await import("node:fs");
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n")) {
        const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}

const { GetBucketLifecycleConfigurationCommand, PutBucketLifecycleConfigurationCommand } = await import("@aws-sdk/client-s3");
const { r2 } = await import("../lib/r2");

const RULE_ID = "expire-tmp-after-1d";

const bucket = process.env.R2_BUCKET;
if (!bucket) throw new Error("R2_BUCKET is not set");

const client = r2();
const rule = {
  ID: RULE_ID,
  Status: "Enabled" as const,
  Filter: { Prefix: "tmp/" },
  Expiration: { Days: 1 },
};

const existing = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
const others = (existing.Rules ?? []).filter((r) => r.ID !== RULE_ID);

await client.send(
  new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: { Rules: [...others, rule] },
  }),
);

const verified = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
const applied = verified.Rules?.find((r) => r.ID === RULE_ID);
console.log(JSON.stringify(applied, null, 2));
if (!applied || applied.Status !== "Enabled" || applied.Expiration?.Days !== 1) {
  throw new Error("lifecycle rule verification failed");
}
console.log(`r2 tmp/ lifecycle verified on bucket ${bucket}`);
