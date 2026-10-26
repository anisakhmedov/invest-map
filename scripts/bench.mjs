// Measures time to the last byte for a few public pages, after a warm-up request.
// Usage: node scripts/bench.mjs http://127.0.0.1:3100 [runs]
const base = process.argv[2] ?? "http://127.0.0.1:3100";
const runs = Number(process.argv[3] ?? 20);
const paths = ["/ru/news", "/ru/projects", "/ru/map", "/ru/auction", "/ru/contacts", "/ru"];

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
for (const p of paths) {
  await fetch(base + p).then((r) => r.arrayBuffer());
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    const res = await fetch(base + p);
    await res.arrayBuffer();
    times.push(performance.now() - t);
  }
  rows.push({ path: p, median_ms: Math.round(median(times) * 10) / 10, max_ms: Math.round(Math.max(...times) * 10) / 10 });
}
console.table(rows);
