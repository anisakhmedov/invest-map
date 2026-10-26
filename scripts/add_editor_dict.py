import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "navMap": "Xarita tahrirlash",
    "mapEditor": {
        "title": "Xarita muharriri",
        "modes": {"region": "Hududlar", "road": "Yo‘llar", "stop": "Bekatlar", "plan": "Reja rasmlari"},
        "newItem": {"region": "Yangi hudud", "road": "Yangi yo‘l", "stop": "Yangi bekat", "plan": "Yangi reja rasmi"},
        "empty": "Hali yozuvlar yo‘q.",
        "redraw": "Qayta chizish",
        "hintDraw": {
            "region": "Xaritada hudud burchaklarini birma-bir bosing. Tugatish uchun oxirgi nuqtani yana bir marta bosing.",
            "road": "Yo‘l nuqtalarini birma-bir bosing. Tugatish uchun oxirgi nuqtani yana bir marta bosing.",
            "stop": "Bekat joylashadigan joyni xaritada bosing.",
        },
        "hintEdit": "Cho‘qqilarni sudrab o‘zgartiring. O‘rtadagi kichik nuqta yangi cho‘qqi qo‘shadi.",
        "hintPlan": "Sariq nuqtalarni sudrab rasmni xaritaga moslang.",
        "multiPart": "Bu hudud bir necha qismdan iborat. Shaklini o‘zgartirib bo‘lmaydi, faqat ma’lumotlarini tahrirlash mumkin.",
        "name": "Nomi",
        "description": "Tavsif",
        "kind": "Turi",
        "kinds": {"road": "Avtomobil yo‘li", "rail": "Temir yo‘l", "bus": "Avtobus", "train": "Poyezd", "other": "Boshqa"},
        "image": "Reja rasmi",
        "noImages": "Avval media kutubxonasiga rasm yuklang.",
        "opacity": "Shaffoflik",
        "close": "Yopish",
        "geometryMissing": "Avval xaritada shaklni chizing.",
        "import": "GeoJSON import qilish",
        "importHint": "Fayl .geojson yoki .json, 5 MB gacha. Hammasi qoralama sifatida qo‘shiladi.",
        "imported": "Qo‘shildi",
        "skipped": "o‘tkazib yuborildi",
        "export": "GeoJSON yuklab olish",
        "loadError": "Xaritani yuklab bo‘lmadi.",
    },
    "errorsExtra": {
        "nameRequired": "Chop etish uchun o‘zbekcha nom kerak.",
        "self_intersection": "Shakl o‘zini kesib o‘tadi. Cho‘qqilarni to‘g‘rilang.",
        "zero_area": "Shaklning maydoni nolga teng.",
        "too_many_vertices": "Cho‘qqilar juda ko‘p (5000 tagacha ruxsat etiladi).",
        "corners_bowtie": "Rasm burchaklari chalkashgan. Ularni to‘rtburchak hosil qiladigan qilib joylang.",
        "corners_degenerate": "Rasm burchaklari bir chiziqda yotibdi.",
        "corners_invalid": "Rasm burchaklari noto‘g‘ri.",
        "planNeedsImage": "Reja uchun media kutubxonasidan rasm tanlang.",
        "import_not_json": "Fayl to‘g‘ri JSON emas.",
        "import_not_geojson": "Bu GeoJSON emas.",
        "import_too_large": "Fayl 5 MB dan katta.",
        "import_too_many_features": "Fayldagi obyektlar 500 tadan ko‘p.",
        "import_nothing": "Faylda import qilinadigan hudud, yo‘l yoki bekat topilmadi.",
    },
}

ru = {
    "navMap": "Редактор карты",
    "mapEditor": {
        "title": "Редактор карты",
        "modes": {"region": "Территории", "road": "Дороги", "stop": "Остановки", "plan": "Планы"},
        "newItem": {"region": "Новая территория", "road": "Новая дорога", "stop": "Новая остановка", "plan": "Новый план"},
        "empty": "Пока нет записей.",
        "redraw": "Нарисовать заново",
        "hintDraw": {
            "region": "Щёлкайте по углам территории на карте. Чтобы закончить, щёлкните по последней точке ещё раз.",
            "road": "Щёлкайте по точкам дороги на карте. Чтобы закончить, щёлкните по последней точке ещё раз.",
            "stop": "Щёлкните на карте там, где находится остановка.",
        },
        "hintEdit": "Перетаскивайте вершины. Маленькая точка посередине добавляет новую вершину.",
        "hintPlan": "Перетаскивайте жёлтые точки, чтобы совместить изображение с картой.",
        "multiPart": "Эта территория состоит из нескольких частей. Форму изменить нельзя, можно править только данные.",
        "name": "Название",
        "description": "Описание",
        "kind": "Тип",
        "kinds": {"road": "Автодорога", "rail": "Железная дорога", "bus": "Автобус", "train": "Поезд", "other": "Другое"},
        "image": "Изображение плана",
        "noImages": "Сначала загрузите изображение в медиабиблиотеку.",
        "opacity": "Прозрачность",
        "close": "Закрыть",
        "geometryMissing": "Сначала нарисуйте фигуру на карте.",
        "import": "Импорт GeoJSON",
        "importHint": "Файл .geojson или .json до 5 МБ. Всё добавится как черновики.",
        "imported": "Добавлено",
        "skipped": "пропущено",
        "export": "Скачать GeoJSON",
        "loadError": "Не удалось загрузить карту.",
    },
    "errorsExtra": {
        "nameRequired": "Для публикации нужно название на узбекском.",
        "self_intersection": "Контур пересекает сам себя. Поправьте вершины.",
        "zero_area": "У фигуры нулевая площадь.",
        "too_many_vertices": "Слишком много вершин (допустимо до 5000).",
        "corners_bowtie": "Углы изображения перепутаны. Расставьте их так, чтобы получился четырёхугольник.",
        "corners_degenerate": "Углы изображения лежат на одной линии.",
        "corners_invalid": "Углы изображения заданы неверно.",
        "planNeedsImage": "Для плана выберите изображение из медиабиблиотеки.",
        "import_not_json": "Файл не является корректным JSON.",
        "import_not_geojson": "Это не GeoJSON.",
        "import_too_large": "Файл больше 5 МБ.",
        "import_too_many_features": "В файле больше 500 объектов.",
        "import_nothing": "В файле нет территорий, дорог или остановок для импорта.",
    },
}

en = {
    "navMap": "Map editor",
    "mapEditor": {
        "title": "Map editor",
        "modes": {"region": "Territories", "road": "Roads", "stop": "Stops", "plan": "Plans"},
        "newItem": {"region": "New territory", "road": "New road", "stop": "New stop", "plan": "New plan"},
        "empty": "No records yet.",
        "redraw": "Redraw",
        "hintDraw": {
            "region": "Click each corner of the territory on the map. Click the last point again to finish.",
            "road": "Click the points of the road on the map. Click the last point again to finish.",
            "stop": "Click on the map where the stop is.",
        },
        "hintEdit": "Drag vertices to reshape. The small dot between two vertices adds a new one.",
        "hintPlan": "Drag the yellow dots to align the image with the map.",
        "multiPart": "This territory has several parts. Its shape cannot be changed here, only its details.",
        "name": "Name",
        "description": "Description",
        "kind": "Type",
        "kinds": {"road": "Road", "rail": "Railway", "bus": "Bus", "train": "Train", "other": "Other"},
        "image": "Plan image",
        "noImages": "Upload an image to the media library first.",
        "opacity": "Opacity",
        "close": "Close",
        "geometryMissing": "Draw the shape on the map first.",
        "import": "Import GeoJSON",
        "importHint": "A .geojson or .json file up to 5 MB. Everything is added as drafts.",
        "imported": "Added",
        "skipped": "skipped",
        "export": "Download GeoJSON",
        "loadError": "The map could not be loaded.",
    },
    "errorsExtra": {
        "nameRequired": "A Uzbek name is required to publish.",
        "self_intersection": "The outline crosses itself. Fix the vertices.",
        "zero_area": "The shape has zero area.",
        "too_many_vertices": "Too many vertices (up to 5000 are allowed).",
        "corners_bowtie": "The image corners are tangled. Place them so they form a quadrilateral.",
        "corners_degenerate": "The image corners lie on one line.",
        "corners_invalid": "The image corners are invalid.",
        "planNeedsImage": "Pick an image from the media library for the plan.",
        "import_not_json": "The file is not valid JSON.",
        "import_not_geojson": "This is not GeoJSON.",
        "import_too_large": "The file is larger than 5 MB.",
        "import_too_many_features": "The file has more than 500 features.",
        "import_nothing": "The file has no territories, roads or stops to import.",
    },
}

oz = tr_obj(uz)

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["admin"]["nav"]["map"] = extra["navMap"]
    d["admin"]["mapEditor"] = extra["mapEditor"]
    d["admin"]["errors"].update(extra["errorsExtra"])
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(json.dumps(oz["mapEditor"]["hintDraw"], ensure_ascii=False, indent=1))
print(json.dumps(oz["errorsExtra"], ensure_ascii=False, indent=1))
