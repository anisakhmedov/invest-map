import { headers } from "next/headers";
import { clientIpFrom } from "./client-ip";

/** The caller's address as seen by our reverse proxy: the one place that decides which X-Forwarded-For entry to trust. */
export async function requestIp(): Promise<string> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}
