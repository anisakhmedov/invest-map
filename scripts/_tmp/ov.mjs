import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 375, height: 800 } });
await p.goto("http://127.0.0.1:3100/en/projects");
await p.waitForLoadState("networkidle");
console.log(await p.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > 376).slice(0, 12).map(e => e.tagName + "." + (e.className||"").toString().slice(0,60) + " r=" + Math.round(e.getBoundingClientRect().right)).join("\n")));
await b.close();
