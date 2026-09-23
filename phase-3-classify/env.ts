import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function loadEnv(projectRoot = process.cwd()): void {
  const paths = [join(projectRoot, ".env"), join(projectRoot, ".env.local")];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const cut = line.indexOf("=");
      if (cut <= 0) continue;
      const key = line.slice(0, cut).trim();
      const value = line.slice(cut + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

export function getGeminiApiKey(): string {
  loadEnv();
  return (process.env.GEMINI_API_KEY || "").trim();
}

export function getGeminiModel(): string {
  loadEnv();
  return (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();
}
