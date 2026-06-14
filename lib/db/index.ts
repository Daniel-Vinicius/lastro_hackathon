import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.NEON_POSTGRES_CONNECTION_STRING;

export const hasDb = Boolean(connectionString);

// null quando a env var está ausente → lib/data.ts cai no fallback leads.json
export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : null;
