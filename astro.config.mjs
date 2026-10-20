import { defineConfig } from 'astro/config';

// Webflow Cloud sets `base` from the environment mount path (/resources)
// and wires the Cloudflare adapter at build time. Do not set them here.
export default defineConfig({});
