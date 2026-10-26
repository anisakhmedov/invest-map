import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

base = "D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/"

uz = {
    "nav": {"users": "Foydalanuvchilar", "roles": "Rollar va huquqlar", "audit": "Audit jurnali"},
    "users": {
        "title": "Foydalanuvchilar", "new": "Yangi foydalanuvchi", "edit": "Foydalanuvchini tahrirlash",
        "search": "Qidiruv (ism yoki elektron pochta)", "role": "Rol", "state": "Holat", "all": "Barchasi",
        "active": "Faol", "inactive": "O‘chirilgan", "apply": "Qo‘llash", "reset": "Tozalash",
        "empty": "Foydalanuvchilar topilmadi.", "you": "siz", "created": "Qo‘shilgan",
        "fields": {
            "email": "Elektron pochta", "fullName": "To‘liq ism", "locale": "Interfeys tili", "role": "Rol",
            "isActive": "Hisob faol (kira oladi)", "password": "Parol", "newPassword": "Yangi parol",
        },
        "passwordHint": "Kamida 10 belgi: harf va raqam bo‘lishi shart.",
        "newPasswordHint": "Bo‘sh qoldirilsa, joriy parol saqlanadi. Yangi parol o‘rnatilsa, odam barcha qurilmalardan chiqarib yuboriladi.",
        "signOutNote": "Rol, holat yoki parol o‘zgarsa, foydalanuvchi qaytadan kirishi kerak bo‘ladi.",
        "selfNote": "O‘z hisobingizning rolini o‘zgartirib yoki o‘chirib bo‘lmaydi.",
        "pager": {"prev": "Oldingi", "next": "Keyingi", "total": "Jami"},
    },
    "roles": {
        "title": "Rollar va huquqlar",
        "lead": "Har bir rol nimaga ruxsat berilganini ko‘rsatadi. Huquqlar tizim tomonidan belgilangan; odamning huquqini o‘zgartirish uchun «Foydalanuvchilar» bo‘limida uning rolini almashtiring.",
        "users": "Foydalanuvchilar", "everything": "Barcha huquqlar", "noRights": "Admin panelga kira olmaydi",
        "allowed": "Ruxsat berilgan", "denied": "Ruxsat yo‘q", "resource": "Bo‘lim",
        "resources": {
            "page": "Sahifalar va yangiliklar", "media": "Media kutubxona", "settings": "Sayt sozlamalari", "map.layer": "Xarita qatlamlari",
            "map.feature": "Xarita obyektlari", "invest": "Investitsiya jadvali", "auction": "Auksion lotlari", "request": "Murojaatlar",
            "task": "Vazifalar", "report": "Hisobotlar", "user": "Foydalanuvchilar", "role": "Rollar", "audit": "Audit jurnali",
        },
        "actions": {"view": "Ko‘rish", "create": "Yaratish", "update": "Tahrirlash", "delete": "O‘chirish", "publish": "Nashr etish"},
        "names": {
            "SUPER_ADMIN": "Bosh administrator", "ADMIN": "Administrator", "CONTENT_EDITOR": "Kontent muharriri",
            "MAP_EDITOR": "Xarita muharriri", "REQUEST_MANAGER": "Murojaatlar menejeri", "INVESTOR": "Investor",
        },
    },
    "audit": {
        "title": "Audit jurnali",
        "lead": "Ma’lumotlardagi barcha o‘zgarishlar va kirishlar. Yozuvlarni o‘chirib yoki o‘zgartirib bo‘lmaydi.",
        "filters": {"action": "Harakat (masalan, page.update)", "entity": "Obyekt turi", "user": "Foydalanuvchi", "from": "Sanadan", "to": "Sanagacha", "all": "Barchasi", "apply": "Qo‘llash", "reset": "Tozalash"},
        "columns": {"time": "Vaqt", "user": "Kim", "action": "Harakat", "object": "Obyekt", "ip": "IP-manzil", "details": "Tafsilotlar"},
        "empty": "Yozuvlar topilmadi.", "system": "Tizim yoki mehmon", "deletedUser": "o‘chirilgan hisob",
        "show": "Ko‘rsatish", "before": "Oldin", "after": "Keyin", "noDetails": "Qo‘shimcha ma’lumot yo‘q.",
        "truncated": "Matn qisqartirildi.", "badRange": "Sanalar noto‘g‘ri, shuning uchun barcha yozuvlar ko‘rsatilgan.",
        "pager": {"prev": "Oldingi", "next": "Keyingi", "total": "Jami"},
    },
    "errors": {
        "emailTaken": "Bu elektron pochta allaqachon band.",
        "weakPassword": "Parol juda oddiy: kamida 10 belgi, harf va raqam bo‘lishi kerak.",
        "forbiddenRole": "Bosh administrator hisoblarini faqat bosh administrator boshqara oladi.",
        "selfLockout": "O‘z hisobingizning rolini o‘zgartirib yoki uni o‘chirib bo‘lmaydi.",
        "lastSuperAdmin": "Kamida bitta faol bosh administrator qolishi shart.",
    },
}

ru = {
    "nav": {"users": "Пользователи", "roles": "Роли и права", "audit": "Журнал аудита"},
    "users": {
        "title": "Пользователи", "new": "Новый пользователь", "edit": "Редактирование пользователя",
        "search": "Поиск (имя или email)", "role": "Роль", "state": "Состояние", "all": "Все",
        "active": "Активные", "inactive": "Отключённые", "apply": "Применить", "reset": "Сбросить",
        "empty": "Пользователи не найдены.", "you": "вы", "created": "Добавлен",
        "fields": {
            "email": "Электронная почта", "fullName": "Полное имя", "locale": "Язык интерфейса", "role": "Роль",
            "isActive": "Учётная запись активна (может входить)", "password": "Пароль", "newPassword": "Новый пароль",
        },
        "passwordHint": "Не короче 10 символов, с буквой и цифрой.",
        "newPasswordHint": "Оставьте пустым, чтобы сохранить текущий пароль. Новый пароль завершит все сеансы человека.",
        "signOutNote": "Если изменить роль, состояние или пароль, человеку придётся войти заново.",
        "selfNote": "Нельзя сменить роль или отключить собственную учётную запись.",
        "pager": {"prev": "Назад", "next": "Далее", "total": "Всего"},
    },
    "roles": {
        "title": "Роли и права",
        "lead": "Для каждой роли показано, что ей разрешено. Права задаёт система; чтобы изменить права человека, смените его роль в разделе «Пользователи».",
        "users": "Пользователей", "everything": "Все права", "noRights": "Не входит в админ-панель",
        "allowed": "Разрешено", "denied": "Нет доступа", "resource": "Раздел",
        "resources": {
            "page": "Страницы и новости", "media": "Медиатека", "settings": "Настройки сайта", "map.layer": "Слои карты",
            "map.feature": "Объекты карты", "invest": "Инвестиционная таблица", "auction": "Лоты аукциона", "request": "Обращения",
            "task": "Задачи", "report": "Отчёты", "user": "Пользователи", "role": "Роли", "audit": "Журнал аудита",
        },
        "actions": {"view": "Просмотр", "create": "Создание", "update": "Изменение", "delete": "Удаление", "publish": "Публикация"},
        "names": {
            "SUPER_ADMIN": "Главный администратор", "ADMIN": "Администратор", "CONTENT_EDITOR": "Редактор контента",
            "MAP_EDITOR": "Редактор карты", "REQUEST_MANAGER": "Менеджер обращений", "INVESTOR": "Инвестор",
        },
    },
    "audit": {
        "title": "Журнал аудита",
        "lead": "Все изменения данных и входы в систему. Записи нельзя изменить или удалить.",
        "filters": {"action": "Действие (например, page.update)", "entity": "Тип объекта", "user": "Пользователь", "from": "С даты", "to": "По дату", "all": "Все", "apply": "Применить", "reset": "Сбросить"},
        "columns": {"time": "Время", "user": "Кто", "action": "Действие", "object": "Объект", "ip": "IP-адрес", "details": "Подробности"},
        "empty": "Записей не найдено.", "system": "Система или гость", "deletedUser": "удалённая учётная запись",
        "show": "Показать", "before": "Было", "after": "Стало", "noDetails": "Подробностей нет.",
        "truncated": "Текст сокращён.", "badRange": "Даты указаны неверно, поэтому показаны все записи.",
        "pager": {"prev": "Назад", "next": "Далее", "total": "Всего"},
    },
    "errors": {
        "emailTaken": "Этот адрес электронной почты уже занят.",
        "weakPassword": "Слишком простой пароль: нужно не меньше 10 символов, буква и цифра.",
        "forbiddenRole": "Учётными записями главных администраторов может управлять только главный администратор.",
        "selfLockout": "Нельзя сменить роль или отключить собственную учётную запись.",
        "lastSuperAdmin": "Должен остаться хотя бы один активный главный администратор.",
    },
}

en = {
    "nav": {"users": "Users", "roles": "Roles and rights", "audit": "Audit log"},
    "users": {
        "title": "Users", "new": "New user", "edit": "Edit user",
        "search": "Search (name or email)", "role": "Role", "state": "State", "all": "All",
        "active": "Active", "inactive": "Disabled", "apply": "Apply", "reset": "Reset",
        "empty": "No users found.", "you": "you", "created": "Added",
        "fields": {
            "email": "Email", "fullName": "Full name", "locale": "Interface language", "role": "Role",
            "isActive": "Account is active (can sign in)", "password": "Password", "newPassword": "New password",
        },
        "passwordHint": "At least 10 characters, with a letter and a digit.",
        "newPasswordHint": "Leave empty to keep the current password. Setting a new one signs the person out everywhere.",
        "signOutNote": "If the role, state or password changes, the person has to sign in again.",
        "selfNote": "You cannot change the role of your own account or disable it.",
        "pager": {"prev": "Previous", "next": "Next", "total": "Total"},
    },
    "roles": {
        "title": "Roles and rights",
        "lead": "Each role shows what it is allowed to do. The rights are set by the system; to change what a person can do, change their role in the Users section.",
        "users": "Users", "everything": "All rights", "noRights": "Cannot open the admin panel",
        "allowed": "Allowed", "denied": "No access", "resource": "Section",
        "resources": {
            "page": "Pages and news", "media": "Media library", "settings": "Site settings", "map.layer": "Map layers",
            "map.feature": "Map objects", "invest": "Investment table", "auction": "Auction lots", "request": "Requests",
            "task": "Tasks", "report": "Reports", "user": "Users", "role": "Roles", "audit": "Audit log",
        },
        "actions": {"view": "View", "create": "Create", "update": "Edit", "delete": "Delete", "publish": "Publish"},
        "names": {
            "SUPER_ADMIN": "Super administrator", "ADMIN": "Administrator", "CONTENT_EDITOR": "Content editor",
            "MAP_EDITOR": "Map editor", "REQUEST_MANAGER": "Request manager", "INVESTOR": "Investor",
        },
    },
    "audit": {
        "title": "Audit log",
        "lead": "Every data change and sign-in. Entries cannot be edited or deleted.",
        "filters": {"action": "Action (e.g. page.update)", "entity": "Object type", "user": "User", "from": "From date", "to": "To date", "all": "All", "apply": "Apply", "reset": "Reset"},
        "columns": {"time": "Time", "user": "Who", "action": "Action", "object": "Object", "ip": "IP address", "details": "Details"},
        "empty": "No entries found.", "system": "System or guest", "deletedUser": "deleted account",
        "show": "Show", "before": "Before", "after": "After", "noDetails": "No further details.",
        "truncated": "The text was shortened.", "badRange": "The dates are not valid, so all entries are shown.",
        "pager": {"prev": "Previous", "next": "Next", "total": "Total"},
    },
    "errors": {
        "emailTaken": "This email address is already in use.",
        "weakPassword": "The password is too weak: use at least 10 characters with a letter and a digit.",
        "forbiddenRole": "Only a super administrator can manage super administrator accounts.",
        "selfLockout": "You cannot change the role of your own account or disable it.",
        "lastSuperAdmin": "At least one active super administrator must remain.",
    },
}

oz = tr_obj(uz)
# Technical identifiers must stay in Latin script.
oz["audit"]["filters"]["action"] = "Ҳаракат (масалан, page.update)"
oz["audit"]["columns"]["ip"] = "IP-манзил"

for lang, x in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    p = base + lang + ".json"
    d = json.load(open(p, encoding="utf8"))
    d["admin"]["nav"].update(x["nav"])
    d["admin"]["users"] = x["users"]
    d["admin"]["roles"] = x["roles"]
    d["admin"]["audit"] = x["audit"]
    d["admin"]["errors"].update(x["errors"])
    with open(p, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(oz["admin"]["users"]["title"] if "admin" in oz else oz["users"]["title"], oz["roles"]["lead"][:80], oz["errors"]["emailTaken"])
