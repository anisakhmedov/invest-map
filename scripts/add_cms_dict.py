import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "nav": {"dashboard": "Boshqaruv paneli", "pages": "Sahifalar va yangiliklar", "media": "Media kutubxonasi", "settings": "Sayt sozlamalari", "viewSite": "Saytni ko‘rish"},
    "common": {
        "save": "Saqlash", "create": "Yaratish", "edit": "Tahrirlash", "delete": "O‘chirish",
        "confirmDelete": "Rostdan ham o‘chirmoqchimisiz?", "status": "Holat", "draft": "Qoralama",
        "published": "Chop etilgan", "actions": "Amallar", "back": "Ortga", "saved": "Saqlandi",
        "kind": "Turi", "kindPage": "Sahifa", "kindNews": "Yangilik", "updated": "Yangilangan",
    },
    "pages": {
        "title": "Sahifalar va yangiliklar", "new": "Yangi sahifa", "edit": "Sahifani tahrirlash",
        "slug": "Manzil (slug)", "slugHint": "Lotin harflari, raqamlar va chiziqcha. Masalan: about-us",
        "titleField": "Sarlavha", "bodyField": "Matn", "bodyHint": "Abzatslar bo‘sh qator bilan ajratiladi.",
        "empty": "Hali sahifalar yo‘q. Birinchisini yarating.", "languages": "Tillar",
    },
    "media": {
        "title": "Media kutubxonasi", "upload": "Fayl yuklash", "file": "Fayl", "alt": "Rasm tavsifi",
        "hint": "JPG, PNG, WebP, GIF yoki PDF. Eng ko‘pi bilan 10 MB.",
        "empty": "Hali fayllar yo‘q. Birinchi faylni yuklang.", "size": "Hajmi", "open": "Ochish",
    },
    "settings": {"title": "Sayt sozlamalari", "contacts": "Aloqa ma’lumotlari", "email": "Elektron pochta", "phone": "Telefon", "address": "Manzil"},
    "errors": {
        "slugInvalid": "Manzil noto‘g‘ri: faqat kichik lotin harflari, raqamlar va bitta chiziqcha ishlating.",
        "slugTaken": "Bu manzil band. Boshqasini tanlang.",
        "titleRequired": "Chop etish uchun o‘zbekcha sarlavha kerak.",
        "invalid": "Maydonlarni tekshiring va qayta urinib ko‘ring.",
        "cannotPublish": "Sizda chop etish huquqi yo‘q. Qoralama sifatida saqlang.",
        "notFound": "Yozuv topilmadi.", "empty": "Fayl tanlang.",
        "too_large": "Fayl 10 MB dan katta.", "unsupported_type": "Bu fayl turi qo‘llab-quvvatlanmaydi.",
        "storageUnavailable": "Fayl ombori hozir ishlamayapti. Keyinroq urinib ko‘ring.",
    },
    "public": {"readMore": "Batafsil", "published": "Chop etilgan", "translationFallback": "Bu matn tanlangan tilda hali tarjima qilinmagan."},
}

ru = {
    "nav": {"dashboard": "Панель управления", "pages": "Страницы и новости", "media": "Медиабиблиотека", "settings": "Настройки сайта", "viewSite": "Открыть сайт"},
    "common": {
        "save": "Сохранить", "create": "Создать", "edit": "Изменить", "delete": "Удалить",
        "confirmDelete": "Точно удалить?", "status": "Статус", "draft": "Черновик",
        "published": "Опубликовано", "actions": "Действия", "back": "Назад", "saved": "Сохранено",
        "kind": "Тип", "kindPage": "Страница", "kindNews": "Новость", "updated": "Обновлено",
    },
    "pages": {
        "title": "Страницы и новости", "new": "Новая страница", "edit": "Редактирование страницы",
        "slug": "Адрес (slug)", "slugHint": "Латиница, цифры и дефис. Например: about-us",
        "titleField": "Заголовок", "bodyField": "Текст", "bodyHint": "Абзацы разделяются пустой строкой.",
        "empty": "Страниц пока нет. Создайте первую.", "languages": "Языки",
    },
    "media": {
        "title": "Медиабиблиотека", "upload": "Загрузить файл", "file": "Файл", "alt": "Описание изображения",
        "hint": "JPG, PNG, WebP, GIF или PDF. Не больше 10 МБ.",
        "empty": "Файлов пока нет. Загрузите первый.", "size": "Размер", "open": "Открыть",
    },
    "settings": {"title": "Настройки сайта", "contacts": "Контактные данные", "email": "Электронная почта", "phone": "Телефон", "address": "Адрес"},
    "errors": {
        "slugInvalid": "Адрес неверный: только строчная латиница, цифры и одиночный дефис.",
        "slugTaken": "Этот адрес занят. Выберите другой.",
        "titleRequired": "Для публикации нужен заголовок на узбекском.",
        "invalid": "Проверьте поля и повторите попытку.",
        "cannotPublish": "У вас нет права публиковать. Сохраните как черновик.",
        "notFound": "Запись не найдена.", "empty": "Выберите файл.",
        "too_large": "Файл больше 10 МБ.", "unsupported_type": "Этот тип файла не поддерживается.",
        "storageUnavailable": "Хранилище файлов сейчас недоступно. Попробуйте позже.",
    },
    "public": {"readMore": "Читать далее", "published": "Опубликовано", "translationFallback": "Этот текст ещё не переведён на выбранный язык."},
}

en = {
    "nav": {"dashboard": "Dashboard", "pages": "Pages and news", "media": "Media library", "settings": "Site settings", "viewSite": "View site"},
    "common": {
        "save": "Save", "create": "Create", "edit": "Edit", "delete": "Delete",
        "confirmDelete": "Delete this item?", "status": "Status", "draft": "Draft",
        "published": "Published", "actions": "Actions", "back": "Back", "saved": "Saved",
        "kind": "Type", "kindPage": "Page", "kindNews": "News", "updated": "Updated",
    },
    "pages": {
        "title": "Pages and news", "new": "New page", "edit": "Edit page",
        "slug": "Address (slug)", "slugHint": "Latin letters, digits and hyphens. Example: about-us",
        "titleField": "Title", "bodyField": "Text", "bodyHint": "Separate paragraphs with a blank line.",
        "empty": "No pages yet. Create the first one.", "languages": "Languages",
    },
    "media": {
        "title": "Media library", "upload": "Upload file", "file": "File", "alt": "Image description",
        "hint": "JPG, PNG, WebP, GIF or PDF. Up to 10 MB.",
        "empty": "No files yet. Upload the first one.", "size": "Size", "open": "Open",
    },
    "settings": {"title": "Site settings", "contacts": "Contact details", "email": "Email", "phone": "Phone", "address": "Address"},
    "errors": {
        "slugInvalid": "Invalid address: use lowercase Latin letters, digits and single hyphens only.",
        "slugTaken": "This address is taken. Choose another.",
        "titleRequired": "A Uzbek title is required to publish.",
        "invalid": "Check the fields and try again.",
        "cannotPublish": "You are not allowed to publish. Save as a draft.",
        "notFound": "Item not found.", "empty": "Choose a file.",
        "too_large": "The file is larger than 10 MB.", "unsupported_type": "This file type is not supported.",
        "storageUnavailable": "File storage is unavailable right now. Try again later.",
    },
    "public": {"readMore": "Read more", "published": "Published", "translationFallback": "This text has not been translated into the selected language yet."},
}

oz = tr_obj(uz)

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    admin = d["admin"]
    for k, v in extra.items():
        if k == "public":
            d["public"] = v
        elif k == "nav":
            admin["nav"] = v
        else:
            admin[k] = v
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(json.dumps(oz["errors"], ensure_ascii=False, indent=1))
