import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "truncated": "Jadvalda {total} tadan faqat oxirgi {shown} tasi ko‘rsatilmoqda. Qolganlarini ko‘rish uchun filtrlardan foydalaning yoki CSV yuklab oling.",
    "errors": {
        "mediaInUsePlan": "Bu rasm xaritadagi reja sifatida ishlatilmoqda. Avval rejani o‘chiring.",
        "regionHasObjects": "Hududda investitsiya obyektlari bor. Avval ularni boshqa hududga o‘tkazing yoki o‘chiring.",
    },
}
ru = {
    "truncated": "В таблице показаны только последние {shown} из {total} объектов. Используйте фильтры или скачайте CSV, чтобы увидеть остальные.",
    "errors": {
        "mediaInUsePlan": "Это изображение используется как план на карте. Сначала удалите план.",
        "regionHasObjects": "В территории есть инвестиционные объекты. Сначала перенесите их в другую территорию или удалите.",
    },
}
en = {
    "truncated": "Only the latest {shown} of {total} objects are shown. Use the filters or download the CSV to see the rest.",
    "errors": {
        "mediaInUsePlan": "This image is used as a plan on the map. Delete the plan first.",
        "regionHasObjects": "The territory has investment objects. Move them to another territory or delete them first.",
    },
}
oz = tr_obj(uz)
# Transliteration must not touch {placeholders} or the CSV acronym.
oz["truncated"] = oz["truncated"].replace("{тотал}", "{total}").replace("{шовн}", "{shown}").replace("ЦСВ", "CSV")

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["admin"]["invest"]["truncated"] = extra["truncated"]
    d["admin"]["errors"].update(extra["errors"])
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(oz["truncated"])
