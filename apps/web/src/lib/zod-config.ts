import { z } from "zod";

// In the browser Zod would probe for `new Function` support, which the site's Content-Security-Policy
// forbids (no 'unsafe-eval'). Skipping the probe avoids a policy violation report; validation is unchanged.
if (typeof window !== "undefined") z.config({ jitless: true });
