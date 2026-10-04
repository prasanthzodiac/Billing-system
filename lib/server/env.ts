import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  SETUP_SECRET: z.string().min(32).optional(),
  EWAYBILL_PROVIDER: z.string().trim().optional(),
  EWAYBILL_API_BASE_URL: z.string().trim().optional(),
  EWAYBILL_API_KEY: z.string().trim().optional(),
  EWAYBILL_API_SECRET: z.string().trim().optional(),
  EWAYBILL_GSTIN: z.string().trim().optional()
});

export function getEnv() {
  const env = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
    TRUST_PROXY: process.env.TRUST_PROXY,
    SETUP_SECRET: process.env.SETUP_SECRET,
    EWAYBILL_PROVIDER: process.env.EWAYBILL_PROVIDER,
    EWAYBILL_API_BASE_URL: process.env.EWAYBILL_API_BASE_URL,
    EWAYBILL_API_KEY: process.env.EWAYBILL_API_KEY,
    EWAYBILL_API_SECRET: process.env.EWAYBILL_API_SECRET,
    EWAYBILL_GSTIN: process.env.EWAYBILL_GSTIN
  });
  if (process.env.NODE_ENV === "production") {
    if (env.SESSION_COOKIE_SECURE !== "true") throw new Error("SESSION_COOKIE_SECURE must be true in production.");
    if (env.SESSION_SECRET.includes("replace-with") || env.SESSION_SECRET.length < 48) throw new Error("SESSION_SECRET must be a unique production secret.");
    if (env.DATABASE_URL.includes("user:password@host")) throw new Error("DATABASE_URL still contains the example placeholder.");
  }
  return env;
}
