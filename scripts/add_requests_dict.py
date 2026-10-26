import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "nav": {"requests": "Murojaatlar", "tasks": "Vazifalar", "reports": "Hisobotlar"},
    "request": {
        "title": "Murojaat yuborish",
        "lead": "Savolingizni yozing yoki obyekt bo‘yicha murojaat qoldiring. Javob berilgach, maxsus havola orqali yozishmani davom ettira olasiz.",
        "fields": {
            "subject": "Mavzu", "message": "Xabar", "name": "Ismingiz", "email": "Elektron pochta", "phone": "Telefon (ixtiyoriy)",
            "files": "Fayllar (ixtiyoriy)", "filesHint": "3 tagacha fayl: JPG, PNG, WebP, GIF yoki PDF, har biri 5 MB gacha.",
            "relatedObject": "Murojaat obyekt bo‘yicha",
        },
        "submit": "Yuborish",
        "privacy": "Ma’lumotlaringiz faqat murojaatga javob berish uchun ishlatiladi.",
        "errors": {
            "tooFast": "Shakl juda tez yuborildi. Bir necha soniya kutib, qayta urinib ko‘ring.",
            "formExpired": "Shakl eskirgan. Sahifani yangilab, qayta yuboring.",
            "rateLimited": "Juda ko‘p murojaat yuborildi. Keyinroq urinib ko‘ring.",
            "invalid": "Maydonlarni tekshiring",
            "rejected": "Xabar yuborilmadi. Matnni tekshirib, qayta urinib ko‘ring.",
            "tooManyFiles": "Eng ko‘pi bilan 3 ta fayl yuklash mumkin.",
            "fileTooLarge": "Fayl 5 MB dan katta.",
            "unsupportedFile": "Bu fayl turi qo‘llab-quvvatlanmaydi.",
            "storageUnavailable": "Fayllarni saqlab bo‘lmadi. Keyinroq urinib ko‘ring.",
            "unknownObject": "Tanlangan obyekt topilmadi.",
            "notFound": "Murojaat topilmadi.",
            "closed": "Murojaat yopilgan. Yangi murojaat yuboring.",
        },
        "track": {
            "title": "Murojaat №{number}",
            "saveLink": "Bu sahifa manzilini saqlab qo‘ying: murojaatni kuzatishning yagona yo‘li shu. Havolani boshqalarga bermang.",
            "status": "Holat", "created": "Yuborilgan", "thread": "Yozishma", "you": "Siz", "staff": "Investitsiya portali jamoasi",
            "attachments": "Fayllar", "replyTitle": "Javob yozish", "replyLabel": "Xabaringiz", "send": "Yuborish", "sent": "Xabar yuborildi.",
            "closedNote": "Murojaat yopilgan. Yangi savol bo‘lsa, yangi murojaat yuboring.",
        },
    },
    "mail": {
        "received": {
            "subject": "Murojaatingiz №{number} qabul qilindi",
            "body": "Assalomu alaykum, {name}!\n\nMurojaatingiz №{number} qabul qilindi: «{subject}».\n\nJavobni kuzatish va yozishmani davom ettirish uchun havola:\n{url}\n\nHavolani boshqalarga bermang: unga ega bo‘lgan har kim yozishmani o‘qiy oladi.",
        },
        "reply": {
            "subject": "Murojaatingiz №{number} bo‘yicha javob",
            "body": "Assalomu alaykum, {name}!\n\n{excerpt}\n\nTo‘liq javobni o‘qish va javob yozish uchun:\n{url}",
        },
        "staffNew": {
            "subject": "Yangi murojaat №{number}: {subject}",
            "body": "Kimdan: {name}\n\n{excerpt}\n\nOchish: {adminUrl}",
        },
        "staffReply": {
            "subject": "Murojaat №{number} bo‘yicha yangi xabar",
            "body": "{name} yozdi:\n\n{excerpt}\n\nOchish: {adminUrl}",
        },
    },
    "adminNav": {"requests": "Murojaatlar", "tasks": "Vazifalar", "reports": "Hisobotlar"},
    "adminRequests": {
        "title": "Murojaatlar", "request": "Murojaat", "thread": "Yozishma", "staff": "Xodim", "internalLabel": "ichki qayd",
        "email": "Elektron pochta", "phone": "Telefon", "object": "Obyekt", "firstResponse": "Birinchi javob",
        "tasks": "Vazifalar", "noTasks": "Bu murojaat bo‘yicha vazifa yo‘q.", "newTask": "Vazifa yaratish",
        "empty": "Murojaatlar topilmadi.", "unassigned": "Biriktirilmagan", "overdueBadge": "muddati o‘tgan",
        "columns": {"subject": "Mavzu", "from": "Kimdan", "status": "Holat", "assignee": "Mas’ul", "due": "Javob muddati", "created": "Yuborilgan"},
        "filters": {"search": "Qidiruv (raqam, mavzu, ism, pochta)", "all": "Hammasi", "me": "Mening", "none": "Biriktirilmagan", "overdue": "Faqat muddati o‘tganlar", "apply": "Qo‘llash", "reset": "Tozalash"},
        "statuses": {"NEW": "Yangi", "IN_PROGRESS": "Jarayonda", "ANSWERED": "Javob berilgan", "CLOSED": "Yopilgan"},
        "controls": {
            "status": "Holat", "assignee": "Mas’ul xodim", "unassigned": "Biriktirilmagan", "reply": "Javob yoki qayd",
            "internalNote": "Ichki qayd (murojaatchiga ko‘rinmaydi)", "internalHint": "Qayd holatni o‘zgartirmaydi va xat yubormaydi.",
            "send": "Yuborish", "sent": "Yuborildi.",
        },
    },
    "adminTasks": {
        "title": "Vazifalar", "new": "Yangi vazifa", "edit": "Vazifani tahrirlash", "empty": "Vazifalar yo‘q.", "all": "Hammasi", "mine": "Faqat mening", "apply": "Qo‘llash", "late": "muddati o‘tgan",
        "fields": {"title": "Sarlavha", "description": "Tavsif", "status": "Holat", "dueAt": "Muddat", "timeHint": "Toshkent vaqti (UTC+5).", "assignee": "Mas’ul", "unassigned": "Biriktirilmagan", "request": "Murojaat"},
        "statuses": {"TODO": "Bajarilishi kerak", "DOING": "Jarayonda", "DONE": "Bajarilgan"},
    },
    "adminReports": {
        "title": "Hisobotlar", "from": "Boshlanish sanasi", "to": "Tugash sanasi", "apply": "Ko‘rsatish", "reset": "Tozalash", "export": "CSV yuklab olish",
        "badRange": "Sanalar noto‘g‘ri, shuning uchun barcha murojaatlar ko‘rsatilmoqda.",
        "total": "Jami murojaatlar", "overdue": "Muddati o‘tgan", "avgResponse": "Birinchi javobgacha o‘rtacha vaqt", "hours": "soat", "slaMet": "Muddatida javob berilgan",
        "byStatus": "Holat bo‘yicha", "byMonth": "Oylar bo‘yicha", "byRegion": "Hududlar bo‘yicha", "noRegion": "Obyektsiz", "noData": "Ma’lumot yo‘q.",
        "mailOn": "Elektron pochta yuborish yoqilgan.", "mailOff": "Elektron pochta yuborish sozlanmagan (SMTP_URL yo‘q): xatlar navbatda turadi.", "mailPending": "Navbatdagi xatlar",
    },
    "adminCabinet": {
        "myOpen": "Mening ochiq murojaatlarim", "unassigned": "Biriktirilmagan yangilari", "overdue": "Muddati o‘tgan",
        "myRequests": "Mening murojaatlarim", "noRequests": "Sizga biriktirilgan ochiq murojaat yo‘q.", "myTasks": "Mening vazifalarim", "noTasks": "Ochiq vazifalar yo‘q.",
        "due": "Muddat", "late": "muddati o‘tgan", "noDue": "Muddatsiz",
    },
    "settingsRequests": {
        "title": "Murojaatlar", "slaHours": "Javob muddati, soat", "slaHint": "Murojaat kelgandan keyin shuncha soat ichida javob berilishi kerak.",
        "notifyEmail": "Yangi murojaatlar uchun pochta", "notifyHint": "Yangi murojaat va murojaatchi javoblari shu manzilga yuboriladi. Bo‘sh qoldirish mumkin.",
    },
    "errorsExtra": {"invalidAssignee": "Bu xodimni biriktirib bo‘lmaydi.", "unknownRequest": "Murojaat topilmadi."},
}

ru = {
    "nav": {"requests": "Обращения", "tasks": "Задачи", "reports": "Отчёты"},
    "request": {
        "title": "Отправить обращение",
        "lead": "Напишите вопрос или оставьте обращение по объекту. После ответа вы сможете продолжить переписку по личной ссылке.",
        "fields": {
            "subject": "Тема", "message": "Сообщение", "name": "Ваше имя", "email": "Электронная почта", "phone": "Телефон (необязательно)",
            "files": "Файлы (необязательно)", "filesHint": "До 3 файлов: JPG, PNG, WebP, GIF или PDF, каждый до 5 МБ.",
            "relatedObject": "Обращение по объекту",
        },
        "submit": "Отправить",
        "privacy": "Ваши данные используются только для ответа на обращение.",
        "errors": {
            "tooFast": "Форма отправлена слишком быстро. Подождите несколько секунд и повторите.",
            "formExpired": "Форма устарела. Обновите страницу и отправьте снова.",
            "rateLimited": "Слишком много обращений. Повторите позже.",
            "invalid": "Проверьте поля",
            "rejected": "Сообщение не отправлено. Проверьте текст и повторите.",
            "tooManyFiles": "Можно загрузить не более 3 файлов.",
            "fileTooLarge": "Файл больше 5 МБ.",
            "unsupportedFile": "Этот тип файла не поддерживается.",
            "storageUnavailable": "Не удалось сохранить файлы. Повторите позже.",
            "unknownObject": "Выбранный объект не найден.",
            "notFound": "Обращение не найдено.",
            "closed": "Обращение закрыто. Отправьте новое.",
        },
        "track": {
            "title": "Обращение №{number}",
            "saveLink": "Сохраните адрес этой страницы: это единственный способ следить за обращением. Не передавайте ссылку другим.",
            "status": "Статус", "created": "Отправлено", "thread": "Переписка", "you": "Вы", "staff": "Команда инвестиционного портала",
            "attachments": "Файлы", "replyTitle": "Написать ответ", "replyLabel": "Ваше сообщение", "send": "Отправить", "sent": "Сообщение отправлено.",
            "closedNote": "Обращение закрыто. Если есть новый вопрос, отправьте новое обращение.",
        },
    },
    "mail": {
        "received": {
            "subject": "Ваше обращение №{number} принято",
            "body": "Здравствуйте, {name}!\n\nВаше обращение №{number} принято: «{subject}».\n\nСледить за ответом и продолжать переписку можно по ссылке:\n{url}\n\nНе передавайте ссылку другим: любой, у кого она есть, сможет читать переписку.",
        },
        "reply": {
            "subject": "Ответ на ваше обращение №{number}",
            "body": "Здравствуйте, {name}!\n\n{excerpt}\n\nЧтобы прочитать ответ целиком и написать в ответ:\n{url}",
        },
        "staffNew": {
            "subject": "Новое обращение №{number}: {subject}",
            "body": "От: {name}\n\n{excerpt}\n\nОткрыть: {adminUrl}",
        },
        "staffReply": {
            "subject": "Новое сообщение по обращению №{number}",
            "body": "{name} написал(а):\n\n{excerpt}\n\nОткрыть: {adminUrl}",
        },
    },
    "adminRequests": {
        "title": "Обращения", "request": "Обращение", "thread": "Переписка", "staff": "Сотрудник", "internalLabel": "внутренняя заметка",
        "email": "Электронная почта", "phone": "Телефон", "object": "Объект", "firstResponse": "Первый ответ",
        "tasks": "Задачи", "noTasks": "По этому обращению задач нет.", "newTask": "Создать задачу",
        "empty": "Обращения не найдены.", "unassigned": "Не назначено", "overdueBadge": "просрочено",
        "columns": {"subject": "Тема", "from": "От кого", "status": "Статус", "assignee": "Ответственный", "due": "Срок ответа", "created": "Отправлено"},
        "filters": {"search": "Поиск (номер, тема, имя, почта)", "all": "Все", "me": "Мои", "none": "Не назначено", "overdue": "Только просроченные", "apply": "Применить", "reset": "Сбросить"},
        "statuses": {"NEW": "Новое", "IN_PROGRESS": "В работе", "ANSWERED": "Есть ответ", "CLOSED": "Закрыто"},
        "controls": {
            "status": "Статус", "assignee": "Ответственный", "unassigned": "Не назначено", "reply": "Ответ или заметка",
            "internalNote": "Внутренняя заметка (не видна заявителю)", "internalHint": "Заметка не меняет статус и не отправляет письмо.",
            "send": "Отправить", "sent": "Отправлено.",
        },
    },
    "adminTasks": {
        "title": "Задачи", "new": "Новая задача", "edit": "Редактирование задачи", "empty": "Задач нет.", "all": "Все", "mine": "Только мои", "apply": "Применить", "late": "просрочено",
        "fields": {"title": "Заголовок", "description": "Описание", "status": "Статус", "dueAt": "Срок", "timeHint": "Время по Ташкенту (UTC+5).", "assignee": "Ответственный", "unassigned": "Не назначено", "request": "Обращение"},
        "statuses": {"TODO": "К выполнению", "DOING": "В работе", "DONE": "Выполнено"},
    },
    "adminReports": {
        "title": "Отчёты", "from": "С даты", "to": "По дату", "apply": "Показать", "reset": "Сбросить", "export": "Скачать CSV",
        "badRange": "Даты указаны неверно, поэтому показаны все обращения.",
        "total": "Всего обращений", "overdue": "Просрочено", "avgResponse": "Среднее время до первого ответа", "hours": "ч", "slaMet": "Отвечено в срок",
        "byStatus": "По статусам", "byMonth": "По месяцам", "byRegion": "По территориям", "noRegion": "Без объекта", "noData": "Нет данных.",
        "mailOn": "Отправка почты включена.", "mailOff": "Отправка почты не настроена (нет SMTP_URL): письма ждут в очереди.", "mailPending": "Писем в очереди",
    },
    "adminCabinet": {
        "myOpen": "Мои открытые обращения", "unassigned": "Новые без ответственного", "overdue": "Просрочено",
        "myRequests": "Мои обращения", "noRequests": "Нет открытых обращений, назначенных вам.", "myTasks": "Мои задачи", "noTasks": "Открытых задач нет.",
        "due": "Срок", "late": "просрочено", "noDue": "Без срока",
    },
    "settingsRequests": {
        "title": "Обращения", "slaHours": "Срок ответа, часов", "slaHint": "За сколько часов после получения нужно ответить на обращение.",
        "notifyEmail": "Почта для новых обращений", "notifyHint": "Сюда приходят уведомления о новых обращениях и ответах заявителей. Можно оставить пустым.",
    },
    "errorsExtra": {"invalidAssignee": "Этого сотрудника нельзя назначить.", "unknownRequest": "Обращение не найдено."},
}

en = {
    "nav": {"requests": "Requests", "tasks": "Tasks", "reports": "Reports"},
    "request": {
        "title": "Send a request",
        "lead": "Ask a question or leave a request about an object. After we reply you can continue the conversation through a private link.",
        "fields": {
            "subject": "Subject", "message": "Message", "name": "Your name", "email": "Email", "phone": "Phone (optional)",
            "files": "Files (optional)", "filesHint": "Up to 3 files: JPG, PNG, WebP, GIF or PDF, each up to 5 MB.",
            "relatedObject": "Request about the object",
        },
        "submit": "Send",
        "privacy": "Your details are used only to answer your request.",
        "errors": {
            "tooFast": "The form was sent too quickly. Wait a few seconds and try again.",
            "formExpired": "The form has expired. Refresh the page and send it again.",
            "rateLimited": "Too many requests. Try again later.",
            "invalid": "Check the fields",
            "rejected": "The message was not sent. Check the text and try again.",
            "tooManyFiles": "You can upload at most 3 files.",
            "fileTooLarge": "The file is larger than 5 MB.",
            "unsupportedFile": "This file type is not supported.",
            "storageUnavailable": "The files could not be saved. Try again later.",
            "unknownObject": "The selected object was not found.",
            "notFound": "Request not found.",
            "closed": "This request is closed. Send a new one.",
        },
        "track": {
            "title": "Request #{number}",
            "saveLink": "Save the address of this page: it is the only way to follow your request. Do not share the link.",
            "status": "Status", "created": "Sent", "thread": "Conversation", "you": "You", "staff": "Investment portal team",
            "attachments": "Files", "replyTitle": "Write a reply", "replyLabel": "Your message", "send": "Send", "sent": "Message sent.",
            "closedNote": "This request is closed. If you have a new question, send a new request.",
        },
    },
    "mail": {
        "received": {
            "subject": "Your request #{number} has been received",
            "body": "Hello, {name}!\n\nWe received your request #{number}: “{subject}”.\n\nFollow the answer and continue the conversation here:\n{url}\n\nKeep this link private: anyone who has it can read the conversation.",
        },
        "reply": {
            "subject": "Reply to your request #{number}",
            "body": "Hello, {name}!\n\n{excerpt}\n\nRead the full reply and answer here:\n{url}",
        },
        "staffNew": {
            "subject": "New request #{number}: {subject}",
            "body": "From: {name}\n\n{excerpt}\n\nOpen: {adminUrl}",
        },
        "staffReply": {
            "subject": "New message in request #{number}",
            "body": "{name} wrote:\n\n{excerpt}\n\nOpen: {adminUrl}",
        },
    },
    "adminRequests": {
        "title": "Requests", "request": "Request", "thread": "Conversation", "staff": "Staff", "internalLabel": "internal note",
        "email": "Email", "phone": "Phone", "object": "Object", "firstResponse": "First reply",
        "tasks": "Tasks", "noTasks": "No tasks for this request.", "newTask": "Create a task",
        "empty": "No requests found.", "unassigned": "Unassigned", "overdueBadge": "overdue",
        "columns": {"subject": "Subject", "from": "From", "status": "Status", "assignee": "Assignee", "due": "Answer due", "created": "Sent"},
        "filters": {"search": "Search (number, subject, name, email)", "all": "All", "me": "Mine", "none": "Unassigned", "overdue": "Overdue only", "apply": "Apply", "reset": "Reset"},
        "statuses": {"NEW": "New", "IN_PROGRESS": "In progress", "ANSWERED": "Answered", "CLOSED": "Closed"},
        "controls": {
            "status": "Status", "assignee": "Assignee", "unassigned": "Unassigned", "reply": "Reply or note",
            "internalNote": "Internal note (hidden from the requester)", "internalHint": "A note does not change the status or send an email.",
            "send": "Send", "sent": "Sent.",
        },
    },
    "adminTasks": {
        "title": "Tasks", "new": "New task", "edit": "Edit task", "empty": "No tasks.", "all": "All", "mine": "Mine only", "apply": "Apply", "late": "overdue",
        "fields": {"title": "Title", "description": "Description", "status": "Status", "dueAt": "Due", "timeHint": "Tashkent time (UTC+5).", "assignee": "Assignee", "unassigned": "Unassigned", "request": "Request"},
        "statuses": {"TODO": "To do", "DOING": "In progress", "DONE": "Done"},
    },
    "adminReports": {
        "title": "Reports", "from": "From date", "to": "To date", "apply": "Show", "reset": "Reset", "export": "Download CSV",
        "badRange": "The dates are not valid, so all requests are shown.",
        "total": "Total requests", "overdue": "Overdue", "avgResponse": "Average time to first reply", "hours": "h", "slaMet": "Answered on time",
        "byStatus": "By status", "byMonth": "By month", "byRegion": "By territory", "noRegion": "No object", "noData": "No data.",
        "mailOn": "Email sending is on.", "mailOff": "Email sending is not set up (no SMTP_URL): messages wait in the queue.", "mailPending": "Emails in the queue",
    },
    "adminCabinet": {
        "myOpen": "My open requests", "unassigned": "New and unassigned", "overdue": "Overdue",
        "myRequests": "My requests", "noRequests": "You have no open requests assigned.", "myTasks": "My tasks", "noTasks": "No open tasks.",
        "due": "Due", "late": "overdue", "noDue": "No due date",
    },
    "settingsRequests": {
        "title": "Requests", "slaHours": "Answer deadline, hours", "slaHint": "How many hours after a request arrives it should be answered.",
        "notifyEmail": "Email for new requests", "notifyHint": "Notifications about new requests and visitor replies go here. May be left empty.",
    },
    "errorsExtra": {"invalidAssignee": "This person cannot be assigned.", "unknownRequest": "Request not found."},
}

oz = tr_obj(uz)
# The email footers use English technical words that must stay as they are.
oz["adminReports"]["mailOff"] = oz["adminReports"]["mailOff"].replace("СМТП_УРЛ", "SMTP_URL")

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    nav = extra["nav"] if "nav" in extra else extra["adminNav"]
    d["admin"]["nav"].update(nav)
    d["request"] = extra["request"]
    d["mail"] = extra["mail"]
    d["admin"]["requests"] = extra["adminRequests"]
    d["admin"]["tasks"] = extra["adminTasks"]
    d["admin"]["reports"] = extra["adminReports"]
    d["admin"]["cabinet"] = extra["adminCabinet"]
    d["admin"]["settings"]["requests"] = extra["settingsRequests"]
    d["admin"]["errors"].update(extra["errorsExtra"])
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(oz["adminReports"]["mailOff"])
print(oz["mail"]["received"]["subject"])
