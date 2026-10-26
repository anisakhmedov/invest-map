import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "navInvest": "Investitsiya jadvali",
    "navAuction": "Auksion lotlari",
    "invest": {
        "title": "Investitsiya jadvali",
        "new": "Yangi obyekt",
        "edit": "Obyektni tahrirlash",
        "empty": "Filtrlarga mos obyekt topilmadi.",
        "export": "CSV yuklab olish",
        "columns": {"name": "Nomi", "region": "Hudud", "category": "Soha", "area": "Maydon, ga", "price": "Narx, USD", "status": "Holat", "publish": "Chop etish", "updated": "Yangilangan"},
        "filters": {"search": "Qidiruv", "region": "Hudud", "category": "Soha", "status": "Holat", "publish": "Chop etish", "all": "Hammasi", "apply": "Qo‘llash", "reset": "Tozalash"},
        "fields": {
            "region": "Hudud", "name": "Nomi", "description": "Tavsif", "category": "Soha", "status": "Holat", "area": "Maydon, ga",
            "price": "Narx, USD", "priceHint": "Bo‘sh qoldirsangiz, narx «so‘rov bo‘yicha» deb ko‘rsatiladi.",
            "lng": "Uzunlik (lng)", "lat": "Kenglik (lat)",
            "coordsHint": "Koordinatalarni xarita muharriridan yoki xaritadagi nuqtadan oling. Masalan: uzunlik 69.24, kenglik 41.30.",
            "publish": "Chop etish", "contacts": "Aloqa uchun shaxs", "contactName": "Ism", "contactPhone": "Telefon", "contactEmail": "Elektron pochta",
            "documents": "Hujjatlar", "documentsHint": "Media kutubxonasidagi fayllardan tanlang.", "noDocuments": "Media kutubxonasida fayllar yo‘q.",
        },
        "pager": {"prev": "Oldingi", "next": "Keyingi", "total": "Jami"},
        "csv": {
            "title": "CSV orqali import",
            "hint": "Fayl yuklang: avval tekshiramiz, keyin tasdiqlaysiz. Noto‘g‘ri qatorlar o‘tkazib yuboriladi.",
            "columnsHint": "Majburiy ustunlar: name, region, category, area, lng, lat. Ixtiyoriy: slug, status, price, publish, name_oz/ru/en, description_*, contact_name, contact_phone, contact_email. Mavjud slug bo‘yicha yozuv yangilanadi.",
            "choose": "CSV fayl",
            "found": "To‘g‘ri qatorlar",
            "willUpdate": "yangilanadi",
            "errorsTitle": "Xatolar (o‘tkazib yuboriladi)",
            "row": "qator",
            "field": "ustun",
            "ignored": "E’tiborga olinmagan ustunlar",
            "importNow": "Import qilish",
            "created": "Yaratildi",
            "updated": "Yangilandi",
            "skipped": "O‘tkazib yuborildi",
            "downgraded": "qoralamaga o‘tkazildi",
            "rowErrors": {
                "unknown_region": "hudud topilmadi",
                "invalid_number": "son noto‘g‘ri",
                "invalid_slug": "slug noto‘g‘ri",
                "duplicate_slug": "slug faylda takrorlangan",
                "invalid_value": "qiymat noto‘g‘ri",
                "name_required": "chop etish uchun o‘zbekcha nom kerak",
            },
        },
    },
    "auctionAdmin": {
        "title": "Auksion lotlari",
        "new": "Yangi lot",
        "edit": "Lotni tahrirlash",
        "empty": "Hali lotlar yo‘q.",
        "columns": {"object": "Obyekt", "period": "Muddat", "startPrice": "Boshlang‘ich narx", "finalPrice": "Yakuniy narx"},
        "fields": {
            "object": "Obyekt", "status": "Holat", "publish": "Chop etish", "startsAt": "Boshlanishi", "endsAt": "Tugashi",
            "timeHint": "Vaqt Toshkent vaqti bilan (UTC+5).", "startPrice": "Boshlang‘ich narx, USD", "finalPrice": "Yakuniy narx, USD",
            "finalHint": "Faqat «Yakunlangan» holatida kiritiladi.", "terms": "Shartlar", "resultNote": "Natija haqida izoh",
        },
        "statuses": {"SCHEDULED": "Rejalashtirilgan", "OPEN": "Davom etmoqda", "CLOSED": "Yakunlangan", "CANCELLED": "Bekor qilingan"},
    },
    "errorsExtra": {
        "csv_empty": "Fayl bo‘sh.", "csv_too_large": "Fayl 5 MB dan katta.", "csv_too_many_rows": "Faylda 2000 tadan ortiq qator bor.",
        "csv_unterminated_quote": "Faylda yopilmagan qo‘shtirnoq bor.", "csv_missing_columns": "Majburiy ustunlar yo‘q:",
        "csv_nothing": "Import qilinadigan to‘g‘ri qator topilmadi.",
        "unknown_region": "Bunday hudud topilmadi.", "unknown_object": "Bunday obyekt topilmadi.",
        "ends_before_start": "Tugash vaqti boshlanishdan keyin bo‘lishi kerak.",
        "result_needs_closed": "Yakuniy narx faqat «Yakunlangan» holatida kiritiladi.",
    },
    "projects": {
        "lead": "Chop etilgan investitsiya obyektlari jadvali. Filtrlang, saralang va xaritada ko‘ring.",
        "all": "Hammasi", "apply": "Qo‘llash",
        "columns": {"name": "Nomi", "region": "Hudud", "category": "Soha", "area": "Maydon", "price": "Narx", "status": "Holat", "map": "Xaritada"},
        "pager": {"prev": "Oldingi", "next": "Keyingi", "total": "Jami"},
    },
    "auction": {
        "lead": "Investitsiya obyektlari bo‘yicha auksion lotlari: muddatlar, boshlang‘ich narx, shartlar va natijalar.",
        "empty": "Hozircha auksion lotlari yo‘q", "emptyHint": "Lotlar boshqaruv panelidan qo‘shilgach shu yerda ko‘rinadi.",
        "current": "Faol va rejalashtirilgan", "finished": "Yakunlangan", "startsAt": "Boshlanishi", "endsAt": "Tugashi",
        "startPrice": "Boshlang‘ich narx", "finalPrice": "Yakuniy narx", "terms": "Shartlar", "result": "Natija", "viewOnMap": "Xaritada ko‘rish",
        "statuses": {"SCHEDULED": "Rejalashtirilgan", "OPEN": "Davom etmoqda", "CLOSED": "Yakunlangan", "CANCELLED": "Bekor qilingan"},
    },
    "mapExtra": {"auctionLabel": "Auksion", "auctionStartPrice": "Boshlang‘ich narx"},
}

ru = {
    "navInvest": "Инвестиционная таблица",
    "navAuction": "Лоты аукциона",
    "invest": {
        "title": "Инвестиционная таблица",
        "new": "Новый объект",
        "edit": "Редактирование объекта",
        "empty": "Нет объектов, подходящих под фильтры.",
        "export": "Скачать CSV",
        "columns": {"name": "Название", "region": "Территория", "category": "Отрасль", "area": "Площадь, га", "price": "Цена, USD", "status": "Статус", "publish": "Публикация", "updated": "Обновлено"},
        "filters": {"search": "Поиск", "region": "Территория", "category": "Отрасль", "status": "Статус", "publish": "Публикация", "all": "Все", "apply": "Применить", "reset": "Сбросить"},
        "fields": {
            "region": "Территория", "name": "Название", "description": "Описание", "category": "Отрасль", "status": "Статус", "area": "Площадь, га",
            "price": "Цена, USD", "priceHint": "Если оставить пустым, цена покажется как «по запросу».",
            "lng": "Долгота (lng)", "lat": "Широта (lat)",
            "coordsHint": "Координаты можно взять в редакторе карты или по точке на карте. Например: долгота 69.24, широта 41.30.",
            "publish": "Публикация", "contacts": "Контактное лицо", "contactName": "Имя", "contactPhone": "Телефон", "contactEmail": "Электронная почта",
            "documents": "Документы", "documentsHint": "Выберите файлы из медиабиблиотеки.", "noDocuments": "В медиабиблиотеке нет файлов.",
        },
        "pager": {"prev": "Назад", "next": "Вперёд", "total": "Всего"},
        "csv": {
            "title": "Импорт из CSV",
            "hint": "Загрузите файл: сначала мы его проверим, потом вы подтвердите импорт. Неверные строки пропускаются.",
            "columnsHint": "Обязательные столбцы: name, region, category, area, lng, lat. Необязательные: slug, status, price, publish, name_oz/ru/en, description_*, contact_name, contact_phone, contact_email. Запись с существующим slug обновляется.",
            "choose": "Файл CSV",
            "found": "Верных строк",
            "willUpdate": "будет обновлено",
            "errorsTitle": "Ошибки (эти строки пропустим)",
            "row": "строка",
            "field": "столбец",
            "ignored": "Игнорируемые столбцы",
            "importNow": "Импортировать",
            "created": "Создано",
            "updated": "Обновлено",
            "skipped": "Пропущено",
            "downgraded": "переведено в черновики",
            "rowErrors": {
                "unknown_region": "территория не найдена",
                "invalid_number": "неверное число",
                "invalid_slug": "неверный slug",
                "duplicate_slug": "slug повторяется в файле",
                "invalid_value": "неверное значение",
                "name_required": "для публикации нужно название на узбекском",
            },
        },
    },
    "auctionAdmin": {
        "title": "Лоты аукциона",
        "new": "Новый лот",
        "edit": "Редактирование лота",
        "empty": "Лотов пока нет.",
        "columns": {"object": "Объект", "period": "Срок", "startPrice": "Начальная цена", "finalPrice": "Итоговая цена"},
        "fields": {
            "object": "Объект", "status": "Статус", "publish": "Публикация", "startsAt": "Начало", "endsAt": "Окончание",
            "timeHint": "Время указывается по Ташкенту (UTC+5).", "startPrice": "Начальная цена, USD", "finalPrice": "Итоговая цена, USD",
            "finalHint": "Вводится только в статусе «Завершён».", "terms": "Условия", "resultNote": "Примечание к итогам",
        },
        "statuses": {"SCHEDULED": "Запланирован", "OPEN": "Идёт", "CLOSED": "Завершён", "CANCELLED": "Отменён"},
    },
    "errorsExtra": {
        "csv_empty": "Файл пуст.", "csv_too_large": "Файл больше 5 МБ.", "csv_too_many_rows": "В файле больше 2000 строк.",
        "csv_unterminated_quote": "В файле незакрытая кавычка.", "csv_missing_columns": "Нет обязательных столбцов:",
        "csv_nothing": "Нет верных строк для импорта.",
        "unknown_region": "Такая территория не найдена.", "unknown_object": "Такой объект не найден.",
        "ends_before_start": "Окончание должно быть позже начала.",
        "result_needs_closed": "Итоговая цена вводится только в статусе «Завершён».",
    },
    "projects": {
        "lead": "Таблица опубликованных инвестиционных объектов. Фильтруйте, сортируйте и смотрите на карте.",
        "all": "Все", "apply": "Применить",
        "columns": {"name": "Название", "region": "Территория", "category": "Отрасль", "area": "Площадь", "price": "Цена", "status": "Статус", "map": "На карте"},
        "pager": {"prev": "Назад", "next": "Вперёд", "total": "Всего"},
    },
    "auction": {
        "lead": "Лоты аукциона по инвестиционным объектам: сроки, начальная цена, условия и итоги.",
        "empty": "Пока нет лотов аукциона", "emptyHint": "Лоты появятся здесь после добавления в панели управления.",
        "current": "Текущие и запланированные", "finished": "Завершённые", "startsAt": "Начало", "endsAt": "Окончание",
        "startPrice": "Начальная цена", "finalPrice": "Итоговая цена", "terms": "Условия", "result": "Итог", "viewOnMap": "Показать на карте",
        "statuses": {"SCHEDULED": "Запланирован", "OPEN": "Идёт", "CLOSED": "Завершён", "CANCELLED": "Отменён"},
    },
    "mapExtra": {"auctionLabel": "Аукцион", "auctionStartPrice": "Начальная цена"},
}

en = {
    "navInvest": "Investment table",
    "navAuction": "Auction lots",
    "invest": {
        "title": "Investment table",
        "new": "New object",
        "edit": "Edit object",
        "empty": "No objects match the filters.",
        "export": "Download CSV",
        "columns": {"name": "Name", "region": "Territory", "category": "Industry", "area": "Area, ha", "price": "Price, USD", "status": "Status", "publish": "Publication", "updated": "Updated"},
        "filters": {"search": "Search", "region": "Territory", "category": "Industry", "status": "Status", "publish": "Publication", "all": "All", "apply": "Apply", "reset": "Reset"},
        "fields": {
            "region": "Territory", "name": "Name", "description": "Description", "category": "Industry", "status": "Status", "area": "Area, ha",
            "price": "Price, USD", "priceHint": "If left empty, the price is shown as “on request”.",
            "lng": "Longitude (lng)", "lat": "Latitude (lat)",
            "coordsHint": "Take coordinates from the map editor or a point on the map. Example: longitude 69.24, latitude 41.30.",
            "publish": "Publication", "contacts": "Contact person", "contactName": "Name", "contactPhone": "Phone", "contactEmail": "Email",
            "documents": "Documents", "documentsHint": "Choose files from the media library.", "noDocuments": "The media library has no files.",
        },
        "pager": {"prev": "Previous", "next": "Next", "total": "Total"},
        "csv": {
            "title": "Import from CSV",
            "hint": "Upload a file: we check it first, then you confirm the import. Invalid rows are skipped.",
            "columnsHint": "Required columns: name, region, category, area, lng, lat. Optional: slug, status, price, publish, name_oz/ru/en, description_*, contact_name, contact_phone, contact_email. A row with an existing slug updates that object.",
            "choose": "CSV file",
            "found": "Valid rows",
            "willUpdate": "will be updated",
            "errorsTitle": "Errors (these rows will be skipped)",
            "row": "row",
            "field": "column",
            "ignored": "Ignored columns",
            "importNow": "Import",
            "created": "Created",
            "updated": "Updated",
            "skipped": "Skipped",
            "downgraded": "saved as drafts",
            "rowErrors": {
                "unknown_region": "territory not found",
                "invalid_number": "invalid number",
                "invalid_slug": "invalid slug",
                "duplicate_slug": "slug is repeated in the file",
                "invalid_value": "invalid value",
                "name_required": "a Uzbek name is required to publish",
            },
        },
    },
    "auctionAdmin": {
        "title": "Auction lots",
        "new": "New lot",
        "edit": "Edit lot",
        "empty": "No lots yet.",
        "columns": {"object": "Object", "period": "Period", "startPrice": "Start price", "finalPrice": "Final price"},
        "fields": {
            "object": "Object", "status": "Status", "publish": "Publication", "startsAt": "Starts", "endsAt": "Ends",
            "timeHint": "Time is in Tashkent time (UTC+5).", "startPrice": "Start price, USD", "finalPrice": "Final price, USD",
            "finalHint": "Only for the “Closed” status.", "terms": "Terms", "resultNote": "Result note",
        },
        "statuses": {"SCHEDULED": "Scheduled", "OPEN": "Open", "CLOSED": "Closed", "CANCELLED": "Cancelled"},
    },
    "errorsExtra": {
        "csv_empty": "The file is empty.", "csv_too_large": "The file is larger than 5 MB.", "csv_too_many_rows": "The file has more than 2000 rows.",
        "csv_unterminated_quote": "The file has an unclosed quote.", "csv_missing_columns": "Required columns are missing:",
        "csv_nothing": "There are no valid rows to import.",
        "unknown_region": "This territory was not found.", "unknown_object": "This object was not found.",
        "ends_before_start": "The end must be after the start.",
        "result_needs_closed": "The final price can only be set for the “Closed” status.",
    },
    "projects": {
        "lead": "A table of published investment objects. Filter, sort and see them on the map.",
        "all": "All", "apply": "Apply",
        "columns": {"name": "Name", "region": "Territory", "category": "Industry", "area": "Area", "price": "Price", "status": "Status", "map": "On map"},
        "pager": {"prev": "Previous", "next": "Next", "total": "Total"},
    },
    "auction": {
        "lead": "Auction lots for investment objects: dates, start price, terms and results.",
        "empty": "No auction lots yet", "emptyHint": "Lots will appear here once they are added in the admin panel.",
        "current": "Current and scheduled", "finished": "Finished", "startsAt": "Starts", "endsAt": "Ends",
        "startPrice": "Start price", "finalPrice": "Final price", "terms": "Terms", "result": "Result", "viewOnMap": "Show on map",
        "statuses": {"SCHEDULED": "Scheduled", "OPEN": "Open", "CLOSED": "Closed", "CANCELLED": "Cancelled"},
    },
    "mapExtra": {"auctionLabel": "Auction", "auctionStartPrice": "Start price"},
}

oz = tr_obj(uz)
# column and field keys in the importer hint are literal CSV headers, keep them Latin
for key in ("columnsHint",):
    oz["invest"]["csv"][key] = uz["invest"]["csv"][key].replace("Majburiy ustunlar", "Мажбурий устунлар").replace("Ixtiyoriy", "Ихтиёрий").replace("Mavjud slug bo‘yicha yozuv yangilanadi.", "Мавжуд slug бўйича ёзув янгиланади.")

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["admin"]["nav"]["invest"] = extra["navInvest"]
    d["admin"]["nav"]["auction"] = extra["navAuction"]
    d["admin"]["invest"] = extra["invest"]
    d["admin"]["auction"] = extra["auctionAdmin"]
    d["admin"]["errors"].update(extra["errorsExtra"])
    d["projects"] = extra["projects"]
    d["auction"] = extra["auction"]
    d["map"].update(extra["mapExtra"])
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(oz["invest"]["csv"]["columnsHint"])
print(oz["invest"]["fields"]["coordsHint"])
