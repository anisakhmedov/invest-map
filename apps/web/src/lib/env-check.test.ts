import { describe, expect, it } from "vitest";
import { productionEnvProblems } from "./env-check";

const good = {
  DATABASE_URL: "postgresql://investmap:Zk3pQ9vL2xWm@db:5432/investmap",
  S3_ENDPOINT: "http://s3:9000",
  S3_BUCKET: "investmap-media",
  S3_ACCESS_KEY: "invest-prod",
  S3_SECRET_KEY: "k8Vn2QpLw7ZrTy4Xb9Jd",
  AUTH_SECRET: "q7Lw2Zr9Tn4Xb8Jd5Vk3Pm6Hs1Cf0Ga9Ue2Yi4Ro7",
  NEXT_PUBLIC_SITE_URL: "https://invest.example.uz",
};

describe("productionEnvProblems", () => {
  it("accepts a complete, non-default configuration", () => {
    expect(productionEnvProblems(good)).toEqual([]);
  });

  it("reports every missing setting by name", () => {
    expect(productionEnvProblems({})).toHaveLength(7);
    expect(productionEnvProblems({ ...good, S3_BUCKET: "" })).toEqual(["S3_BUCKET is not set"]);
  });

  it("rejects short and placeholder secrets without printing them", () => {
    const short = productionEnvProblems({ ...good, AUTH_SECRET: "abc123" });
    expect(short.join()).toMatch(/at least 32/);
    expect(short.join()).not.toContain("abc123");
    expect(productionEnvProblems({ ...good, AUTH_SECRET: "change-me-change-me-change-me-change-me" }).join()).toMatch(/placeholder/);
  });

  it("rejects development defaults for storage and database", () => {
    expect(productionEnvProblems({ ...good, S3_SECRET_KEY: "investmap_dev_secret" })).toHaveLength(1);
    expect(productionEnvProblems({ ...good, DATABASE_URL: "postgresql://investmap:investmap_dev@db/x" })).toHaveLength(1);
  });

  it("wants https for a real domain but lets localhost test builds through", () => {
    expect(productionEnvProblems({ ...good, NEXT_PUBLIC_SITE_URL: "http://invest.example.uz" }).join()).toMatch(/https/);
    expect(productionEnvProblems({ ...good, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100" })).toEqual([]);
    expect(productionEnvProblems({ ...good, NEXT_PUBLIC_SITE_URL: "not a url" }).join()).toMatch(/not a valid/);
  });
});
