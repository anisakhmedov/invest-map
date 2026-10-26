// DEMO DATA ONLY. Regions are simple hexagons around real city centres and every object is invented,
// so the public map can be developed and tested. Replace with real data through the admin panel.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type L4 = { uz: string; oz: string; ru: string; en: string };

const regions: { slug: string; name: L4; center: [number, number] }[] = [
  { slug: "demo-toshkent", name: { uz: "Toshkent", oz: "Тошкент", ru: "Ташкент", en: "Tashkent" }, center: [69.24, 41.3] },
  { slug: "demo-samarqand", name: { uz: "Samarqand", oz: "Самарқанд", ru: "Самарканд", en: "Samarkand" }, center: [66.96, 39.65] },
  { slug: "demo-fargona", name: { uz: "Farg‘ona", oz: "Фарғона", ru: "Фергана", en: "Fergana" }, center: [71.78, 40.38] },
];

const categories: { key: string; name: L4 }[] = [
  { key: "industry", name: { uz: "Sanoat uchastkasi", oz: "Саноат участкаси", ru: "Промышленный участок", en: "Industrial plot" } },
  { key: "agriculture", name: { uz: "Qishloq xo‘jaligi yeri", oz: "Қишлоқ хўжалиги ери", ru: "Сельхозземля", en: "Farmland" } },
  { key: "tourism", name: { uz: "Turizm obyekti", oz: "Туризм объекти", ru: "Туристический объект", en: "Tourism site" } },
  { key: "energy", name: { uz: "Energetika uchastkasi", oz: "Энергетика участкаси", ru: "Энергетический участок", en: "Energy site" } },
  { key: "logistics", name: { uz: "Logistika markazi", oz: "Логистика маркази", ru: "Логистический центр", en: "Logistics hub" } },
  { key: "services", name: { uz: "Xizmatlar binosi", oz: "Хизматлар биноси", ru: "Здание под услуги", en: "Services building" } },
];

const demoTag: L4 = { uz: "demo", oz: "демо", ru: "демо", en: "demo" };
const demoText: L4 = {
  uz: "Demo ma’lumot: haqiqiy obyekt emas.",
  oz: "Демо маълумот: ҳақиқий объект эмас.",
  ru: "Демонстрационные данные: это не реальный объект.",
  en: "Demo data: not a real object.",
};

const STATUSES = ["AVAILABLE", "AVAILABLE", "RESERVED", "AUCTION", "TAKEN"] as const;

function hexagon([cx, cy]: [number, number]) {
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [Number((cx + Math.cos(a) * 0.55).toFixed(5)), Number((cy + Math.sin(a) * 0.4).toFixed(5))];
  });
  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}

async function main() {
  let n = 0;
  for (const [ri, r] of regions.entries()) {
    const region = await db.region.upsert({
      where: { slug: r.slug },
      update: {},
      create: {
        slug: r.slug,
        status: "PUBLISHED",
        name: r.name,
        description: demoText,
        geometry: hexagon(r.center),
        centerLng: r.center[0],
        centerLat: r.center[1],
      },
    });

    for (let i = 0; i < 5; i++) {
      n++;
      const cat = categories[(ri * 2 + i) % categories.length];
      const angle = (i / 5) * Math.PI * 2 + ri;
      const dist = 0.12 + (i % 3) * 0.1;
      const label = (l: keyof L4) => `${cat.name[l]} №${n} (${demoTag[l]})`;
      await db.investObject.upsert({
        where: { slug: `demo-object-${n}` },
        update: {},
        create: {
          slug: `demo-object-${n}`,
          regionId: region.id,
          publish: "PUBLISHED",
          name: { uz: label("uz"), oz: label("oz"), ru: label("ru"), en: label("en") },
          description: demoText,
          category: cat.key,
          status: STATUSES[(n + i) % STATUSES.length],
          areaHa: [2.5, 8, 15, 40, 120][(n * 3 + i) % 5],
          priceUsd: i === 4 ? null : [15000, 42000, 90000, 250000][(n + i) % 4],
          lng: Number((r.center[0] + Math.cos(angle) * dist).toFixed(5)),
          lat: Number((r.center[1] + Math.sin(angle) * dist * 0.75).toFixed(5)),
        },
      });
    }
  }
  console.log(`Demo data ready: ${regions.length} regions, ${n} objects`);
}

main().finally(() => db.$disconnect());
