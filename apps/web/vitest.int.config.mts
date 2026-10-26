import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests talk to the real Postgres and S3 from docker-compose (`docker compose up -d`).
process.loadEnvFile(".env");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
