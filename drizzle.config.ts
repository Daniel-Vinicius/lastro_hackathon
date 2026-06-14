import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Next não está rodando aqui; carrega .env exatamente como o Next faria.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.NEON_POSTGRES_CONNECTION_STRING!,
  },
});
