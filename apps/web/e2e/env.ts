/** Throw-away staff account made by global setup; the credentials reach the test workers through the environment. */
export const staff = () => ({
  email: process.env.E2E_STAFF_EMAIL ?? "",
  password: process.env.E2E_STAFF_PASSWORD ?? "",
});
export const E2E_NAME = "e2e-run";

/** A super administrator with the same password as the regular staff account. */
export const superAdmin = () => ({ email: process.env.E2E_SUPER_EMAIL ?? "", password: process.env.E2E_STAFF_PASSWORD ?? "" });
