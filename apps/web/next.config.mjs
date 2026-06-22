import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadRootEnvLocal() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = path.resolve(currentDir, "../../.env.local");

  if (!fs.existsSync(rootEnvPath)) {
    return;
  }

  const content = fs.readFileSync(rootEnvPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadRootEnvLocal();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true
};

export default nextConfig;
