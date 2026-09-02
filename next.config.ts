import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "@aws-sdk/client-s3",
    "re2",
    "url-regex-safe",
    "@metascraper/helpers",
    "metascraper",
    "metascraper-title",
    "metascraper-description",
    "metascraper-image",
    "metascraper-logo",
    "metascraper-logo-favicon",
    "metascraper-publisher",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
