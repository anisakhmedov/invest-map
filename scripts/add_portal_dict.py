import json

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "home": {
        "stepsTitle": "Qanday ishlaydi",
        "steps": [
            {"title": "Xaritadan qidiring", "text": "Hudud, soha yoki narx bo‘yicha filtrlang va mos uchastkani toping."},
            {"title": "Ma’lumotni ko‘ring", "text": "Har bir hudud va uchastka kartochkasida maydon, narx, infratuzilma va hujjatlar bor."},
            {"title": "Murojaat yuboring", "text": "Qiziqqan obyekt bo‘yicha mas’ul xodimga to‘g‘ridan-to‘g‘ri murojaat qiling."},
        ],
        "ctaTitle": "Loyihangiz uchun joy topishga tayyormisiz?",
        "ctaText": "Xaritani oching va hududlarni solishtiring.",
    },
    "footer": {"rights": "Barcha huquqlar himoyalangan", "sections": "Bo‘limlar"},
    "about": {
        "title": "Loyiha haqida",
        "lead": "InvestMap — hududlardagi investitsiya imkoniyatlarini yagona interaktiv xaritada jamlaydigan portal.",
        "blocks": [
            {"title": "Maqsad", "text": "Investorga kerakli ma’lumotni tez va ishonchli ko‘rsatish."},
            {"title": "Nimalar bor", "text": "Hududlar, yer uchastkalari, yo‘llar, bekatlar, investitsiya jadvali va auksion lotlari."},
            {"title": "Kim uchun", "text": "Investorlar, tadbirkorlar va hududiy rivojlanish bilan shug‘ullanuvchi mutasaddilar uchun."},
        ],
    },
    "news": {
        "title": "Yangiliklar",
        "lead": "Portal va investitsiya sohasidagi so‘nggi e’lonlar.",
        "empty": "Hozircha yangiliklar yo‘q",
        "emptyHint": "Yangiliklar boshqaruv panelidan qo‘shilgach shu yerda ko‘rinadi.",
    },
    "contacts": {
        "title": "Aloqa",
        "lead": "Savollaringiz bo‘lsa, biz bilan bog‘laning.",
        "notSet": "Aloqa ma’lumotlari sayt sozlamalarida kiritilgach shu yerda ko‘rinadi.",
        "requestSoon": "Murojaat shakli keyingi bosqichda qo‘shiladi.",
    },
    "soon": {"title": "Bo‘lim tayyorlanmoqda", "text": "Bu bo‘lim ishlab chiqilmoqda va tez orada ochiladi.", "back": "Bosh sahifaga qaytish"},
    "notFound": {"title": "Sahifa topilmadi", "text": "Manzil noto‘g‘ri yoki sahifa ko‘chirilgan.", "home": "Bosh sahifaga"},
}

ru = {
    "home": {
        "stepsTitle": "Как это работает",
        "steps": [
            {"title": "Найдите на карте", "text": "Отфильтруйте по району, отрасли или цене и найдите подходящий участок."},
            {"title": "Изучите данные", "text": "В карточке района и участка — площадь, цена, инфраструктура и документы."},
            {"title": "Отправьте обращение", "text": "По интересующему объекту напишите напрямую ответственному сотруднику."},
        ],
        "ctaTitle": "Готовы найти место для своего проекта?",
        "ctaText": "Откройте карту и сравните территории.",
    },
    "footer": {"rights": "Все права защищены", "sections": "Разделы"},
    "about": {
        "title": "О проекте",
        "lead": "InvestMap — портал, который собирает инвестиционные возможности регионов на одной интерактивной карте.",
        "blocks": [
            {"title": "Цель", "text": "Быстро и достоверно показать инвестору нужные сведения."},
            {"title": "Что внутри", "text": "Территории, земельные участки, дороги, остановки, инвестиционная таблица и лоты аукциона."},
            {"title": "Для кого", "text": "Для инвесторов, предпринимателей и специалистов по развитию территорий."},
        ],
    },
    "news": {
        "title": "Новости",
        "lead": "Последние объявления портала и инвестиционной сферы.",
        "empty": "Пока нет новостей",
        "emptyHint": "Новости появятся здесь после добавления в панели управления.",
    },
    "contacts": {
        "title": "Контакты",
        "lead": "Если остались вопросы, свяжитесь с нами.",
        "notSet": "Контактные данные появятся здесь после заполнения в настройках сайта.",
        "requestSoon": "Форма обращения будет добавлена на следующем этапе.",
    },
    "soon": {"title": "Раздел в разработке", "text": "Этот раздел разрабатывается и скоро откроется.", "back": "Вернуться на главную"},
    "notFound": {"title": "Страница не найдена", "text": "Адрес указан неверно или страница перемещена.", "home": "На главную"},
}

en = {
    "home": {
        "stepsTitle": "How it works",
        "steps": [
            {"title": "Search the map", "text": "Filter by district, industry or price and find a suitable plot."},
            {"title": "Review the details", "text": "Each district and plot card lists area, price, infrastructure and documents."},
            {"title": "Send a request", "text": "Write directly to the responsible officer about the object you like."},
        ],
        "ctaTitle": "Ready to find a place for your project?",
        "ctaText": "Open the map and compare territories.",
    },
    "footer": {"rights": "All rights reserved", "sections": "Sections"},
    "about": {
        "title": "About the project",
        "lead": "InvestMap brings the investment opportunities of the regions together on one interactive map.",
        "blocks": [
            {"title": "Purpose", "text": "Show investors the information they need, quickly and reliably."},
            {"title": "What is inside", "text": "Territories, land plots, roads, stops, an investment table and auction lots."},
            {"title": "Who it is for", "text": "Investors, entrepreneurs and specialists in regional development."},
        ],
    },
    "news": {
        "title": "News",
        "lead": "Latest announcements from the portal and the investment sector.",
        "empty": "No news yet",
        "emptyHint": "News will appear here once it is added in the admin panel.",
    },
    "contacts": {
        "title": "Contacts",
        "lead": "If you have questions, get in touch.",
        "notSet": "Contact details will appear here once they are entered in the site settings.",
        "requestSoon": "The request form will be added in a later stage.",
    },
    "soon": {"title": "Section in progress", "text": "This section is being built and will open soon.", "back": "Back to home"},
    "notFound": {"title": "Page not found", "text": "The address is wrong or the page has moved.", "home": "Go to home"},
}

# ---- Uzbek Latin -> Cyrillic -------------------------------------------------
APOS = "‘ʻ'`"
SIMPLE = {
    "a": "а", "b": "б", "c": "ц", "d": "д", "f": "ф", "g": "г", "h": "ҳ", "i": "и",
    "j": "ж", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "q": "қ",
    "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "w": "в", "x": "х", "y": "й", "z": "з",
}


def cap(src, out):
    return out.capitalize() if src[0].isupper() else out


def translit(s):
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        low = c.lower()
        nxt = s[i + 1] if i + 1 < n else ""
        nl = nxt.lower()
        two = s[i:i + 2].lower()
        if low in "og" and nxt in APOS and nxt:
            out.append(cap(c, "ў" if low == "o" else "ғ"))
            i += 2
            continue
        if two == "sh":
            out.append(cap(c, "ш")); i += 2; continue
        if two == "ch":
            out.append(cap(c, "ч")); i += 2; continue
        if two == "ng":
            out.append(cap(c, "нг")); i += 2; continue
        if low == "y" and nl in ("o", "u", "a") and nl != "":
            # yo‘ = й + ў, so only treat plain "yo" as ё
            if not (nl == "o" and i + 2 < n and s[i + 2] in APOS):
                out.append(cap(c, {"o": "ё", "u": "ю", "a": "я"}[nl]))
                i += 2
                continue
        if low == "e":
            prev = s[i - 1] if i else " "
            out.append(cap(c, "е" if prev.isalpha() else "э"))
            i += 1
            continue
        if c == "’":
            out.append("ъ"); i += 1; continue
        if low in SIMPLE:
            out.append(cap(c, SIMPLE[low])); i += 1; continue
        out.append(c)
        i += 1
    return "".join(out)


def tr_obj(o):
    if isinstance(o, str):
        return translit(o)
    if isinstance(o, list):
        return [tr_obj(x) for x in o]
    return {k: tr_obj(v) for k, v in o.items()}


oz = tr_obj(uz)
oz["about"]["lead"] = oz["about"]["lead"].replace("ИнвестМап", "InvestMap").replace("Инвестмап", "InvestMap")

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    for k, v in extra.items():
        if k in d and isinstance(d[k], dict):
            d[k].update(v)
        else:
            d[k] = v
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(json.dumps(oz, ensure_ascii=False, indent=1))
