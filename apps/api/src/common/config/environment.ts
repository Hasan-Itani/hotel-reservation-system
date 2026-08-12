import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_CORS_ORIGINS: z.string().optional(),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): ApiEnvironment {
  const parsed = environmentSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid API environment configuration: ${details}`);
  }

  return parsed.data;
}

export function parseAllowedOrigins(value: string | undefined) {
  return (value || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
