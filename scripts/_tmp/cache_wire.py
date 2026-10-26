root = "D:/WORK/InvestMap/apps/web/"

def edit(path, pairs):
    p = root + path
    s = open(p, encoding="utf8").read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf8").write(s)

edit("src/features/map/data.ts", [
    ('import { db } from "@/lib/db";', 'import { cacheLife, cacheTag } from "next/cache";\nimport { db } from "@/lib/db";'),
    ('/** Published map data. Rows with broken geometry or unknown categories are skipped, never thrown on. */\nexport async function getMapData(): Promise<{\n  regions: MapRegion[];\n  objects: MapObject[];\n  roads: MapRoad[];\n  stops: MapStop[];\n  plans: MapPlan[];\n}> {',
     'type MapData = {\n  regions: MapRegion[];\n  objects: MapObject[];\n  roads: MapRoad[];\n  stops: MapStop[];\n  plans: MapPlan[];\n};\n\n/** Cached until an admin changes map or investment data (`updateTag("public-data")`). */\nexport async function getMapData(): Promise<MapData> {\n  "use cache";\n  cacheTag("public-data");\n  cacheLife("hours");\n  return loadMapData();\n}\n\n/** Published map data. Rows with broken geometry or unknown categories are skipped, never thrown on. */\nexport async function loadMapData(): Promise<MapData> {'),
])
edit("src/features/invest/public-data.ts", [
    ('import { db } from "@/lib/db";', 'import { cacheLife, cacheTag } from "next/cache";\nimport { db } from "@/lib/db";'),
    ('/** Published lots of published objects in published regions, split into current and finished. */\nexport async function getPublicAuctions(): Promise<{ current: PublicAuction[]; finished: PublicAuction[] }> {',
     'type PublicAuctions = { current: PublicAuction[]; finished: PublicAuction[] };\n\n/** Cached until an admin changes investment data (`updateTag("public-data")`). */\nexport async function getPublicAuctions(): Promise<PublicAuctions> {\n  "use cache";\n  cacheTag("public-data");\n  cacheLife("hours");\n  return loadPublicAuctions();\n}\n\n/** Published lots of published objects in published regions, split into current and finished. */\nexport async function loadPublicAuctions(): Promise<PublicAuctions> {'),
])
edit("src/lib/site.ts", [
    ('import { contactsSchema', 'import { cacheLife, cacheTag } from "next/cache";\nimport { contactsSchema'),
    ('/** Reads contact details from site settings; invalid or missing data yields empty values. */\nexport async function getContacts(): Promise<Contacts> {',
     '/** Cached until the contacts are saved (`updateTag("site-settings")`). */\nexport async function getContacts(): Promise<Contacts> {\n  "use cache";\n  cacheTag("site-settings");\n  cacheLife("hours");\n  return loadContacts();\n}\n\n/** Reads contact details from site settings; invalid or missing data yields empty values. */\nexport async function loadContacts(): Promise<Contacts> {'),
])
