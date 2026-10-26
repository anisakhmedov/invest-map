import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "mapLabel": "Investitsiya xaritasi",
    "searchLabel": "Qidiruv",
    "searchPlaceholder": "Hudud yoki obyekt nomi",
    "noResults": "Hech narsa topilmadi",
    "layers": "Qatlamlar",
    "layerRegions": "Hududlar",
    "layerObjects": "Obyektlar",
    "filters": "Filtrlar",
    "reset": "Tozalash",
    "category": "Soha",
    "status": "Holat",
    "areaRange": "Maydon (ga)",
    "areaMin": "Dan",
    "areaMax": "Gacha",
    "priceMax": "Narx, USD gacha",
    "found": "Topildi",
    "legend": "Belgilar",
    "listTitle": "Obyektlar ro‘yxati",
    "showList": "Ro‘yxat",
    "showMap": "Xarita",
    "emptyList": "Filtrlarga mos obyekt yo‘q.",
    "categories": {"industry": "Sanoat", "agriculture": "Qishloq xo‘jaligi", "tourism": "Turizm", "energy": "Energetika", "logistics": "Logistika", "services": "Xizmatlar"},
    "statuses": {"AVAILABLE": "Bo‘sh", "RESERVED": "Band qilingan", "AUCTION": "Auksionda", "TAKEN": "Band"},
    "region": "Hudud",
    "objectsCount": "Obyektlar",
    "availableCount": "Bo‘sh",
    "totalArea": "Umumiy maydon",
    "area": "Maydon",
    "price": "Narx",
    "priceOnRequest": "So‘rov bo‘yicha",
    "sendRequest": "Murojaat yuborish",
    "close": "Yopish",
    "ha": "ga",
    "loadError": "Xaritani yuklab bo‘lmadi.",
    "noData": "Hozircha xaritada ma’lumot yo‘q.",
    "selected": "Tanlangan",
}

ru = {
    "mapLabel": "Инвестиционная карта",
    "searchLabel": "Поиск",
    "searchPlaceholder": "Название района или объекта",
    "noResults": "Ничего не найдено",
    "layers": "Слои",
    "layerRegions": "Территории",
    "layerObjects": "Объекты",
    "filters": "Фильтры",
    "reset": "Сбросить",
    "category": "Отрасль",
    "status": "Статус",
    "areaRange": "Площадь (га)",
    "areaMin": "От",
    "areaMax": "До",
    "priceMax": "Цена, USD до",
    "found": "Найдено",
    "legend": "Обозначения",
    "listTitle": "Список объектов",
    "showList": "Список",
    "showMap": "Карта",
    "emptyList": "Нет объектов, подходящих под фильтры.",
    "categories": {"industry": "Промышленность", "agriculture": "Сельское хозяйство", "tourism": "Туризм", "energy": "Энергетика", "logistics": "Логистика", "services": "Услуги"},
    "statuses": {"AVAILABLE": "Свободен", "RESERVED": "Зарезервирован", "AUCTION": "На аукционе", "TAKEN": "Занят"},
    "region": "Территория",
    "objectsCount": "Объекты",
    "availableCount": "Свободно",
    "totalArea": "Общая площадь",
    "area": "Площадь",
    "price": "Цена",
    "priceOnRequest": "По запросу",
    "sendRequest": "Отправить обращение",
    "close": "Закрыть",
    "ha": "га",
    "loadError": "Не удалось загрузить карту.",
    "noData": "На карте пока нет данных.",
    "selected": "Выбрано",
}

en = {
    "mapLabel": "Investment map",
    "searchLabel": "Search",
    "searchPlaceholder": "District or object name",
    "noResults": "Nothing found",
    "layers": "Layers",
    "layerRegions": "Territories",
    "layerObjects": "Objects",
    "filters": "Filters",
    "reset": "Reset",
    "category": "Industry",
    "status": "Status",
    "areaRange": "Area (ha)",
    "areaMin": "From",
    "areaMax": "To",
    "priceMax": "Price, USD up to",
    "found": "Found",
    "legend": "Legend",
    "listTitle": "List of objects",
    "showList": "List",
    "showMap": "Map",
    "emptyList": "No objects match the filters.",
    "categories": {"industry": "Industry", "agriculture": "Agriculture", "tourism": "Tourism", "energy": "Energy", "logistics": "Logistics", "services": "Services"},
    "statuses": {"AVAILABLE": "Available", "RESERVED": "Reserved", "AUCTION": "At auction", "TAKEN": "Taken"},
    "region": "Territory",
    "objectsCount": "Objects",
    "availableCount": "Available",
    "totalArea": "Total area",
    "area": "Area",
    "price": "Price",
    "priceOnRequest": "On request",
    "sendRequest": "Send a request",
    "close": "Close",
    "ha": "ha",
    "loadError": "The map could not be loaded.",
    "noData": "There is no data on the map yet.",
    "selected": "Selected",
}

oz = tr_obj(uz)

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["map"] = extra
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(json.dumps(oz, ensure_ascii=False, indent=1)[:1800])
