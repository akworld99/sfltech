import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// The portal is mounted under sfltech.ai/team (Webflow Cloud mount path).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/team";

const config: NextConfig = {
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  images: { unoptimized: true },
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};

export default config;

initOpenNextCloudflareForDev();
