import { productionEnvProblems } from "@/lib/env-check";

/** Refuses to start a production server with missing or placeholder settings, so a bad deploy fails loudly. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_ENV_CHECK === "1") return;
  const problems = productionEnvProblems(process.env);
  if (problems.length > 0) {
    throw new Error(`Refusing to start, fix the settings first:\n - ${problems.join("\n - ")}`);
  }
}
