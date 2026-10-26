import json, sys
sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"
uz = {"layerRoads": "Yo‘llar", "layerStops": "Bekatlar", "layerPlans": "Reja rasmlari",
      "kinds": {"road": "Avtomobil yo‘li", "rail": "Temir yo‘l", "bus": "Avtobus bekati", "train": "Poyezd bekati", "other": "Bekat"},
      "typeLabel": "Turi"}
ru = {"layerRoads": "Дороги", "layerStops": "Остановки", "layerPlans": "Планы",
      "kinds": {"road": "Автодорога", "rail": "Железная дорога", "bus": "Автобусная остановка", "train": "Вокзал или станция", "other": "Остановка"},
      "typeLabel": "Тип"}
en = {"layerRoads": "Roads", "layerStops": "Stops", "layerPlans": "Plans",
      "kinds": {"road": "Road", "rail": "Railway", "bus": "Bus stop", "train": "Train station", "other": "Stop"},
      "typeLabel": "Type"}
oz = tr_obj(uz)
for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["map"].update(extra)
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
print(json.dumps(oz, ensure_ascii=False))
