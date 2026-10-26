import json
import sys

sys.path.insert(0, "D:/WORK/InvestMap/scripts")
from translit import tr_obj  # noqa: E402

root = "D:/WORK/InvestMap/apps/web/"


def edit(path, pairs):
    p = root + path
    s = open(p, encoding="utf8").read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf8").write(s)


# ---- styles ----
p = root + "src/app/globals.css"
s = open(p, encoding="utf8").read()
s += '''
/* Low-vision settings from the accessibility panel */
html[data-font="lg"] {
  font-size: 125%;
}
html[data-font="xl"] {
  font-size: 150%;
}

:root[data-contrast="high"] {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-2: #f0f0f0;
  --fg: #000000;
  --fg-muted: #1c1c1c;
  --border: #000000;
  --brand: #00473a;
  --brand-fg: #ffffff;
  --brand-soft: #d7efe8;
  --accent: #7a4a00;
  --focus: #0000d0;
}
:root[data-contrast="high"][data-theme="dark"] {
  --bg: #000000;
  --surface: #000000;
  --surface-2: #1a1a1a;
  --fg: #ffffff;
  --fg-muted: #f0f0f0;
  --border: #ffffff;
  --brand: #6ff5d2;
  --brand-fg: #000000;
  --brand-soft: #0a3b30;
  --accent: #ffc857;
  --focus: #9ec5ff;
}
:root[data-contrast="high"] a {
  text-decoration: underline;
}

:root[data-motion="reduce"] *,
:root[data-motion="reduce"] *::before,
:root[data-motion="reduce"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
'''
open(p, "w", encoding="utf8").write(s)

# ---- apply saved settings before the first paint ----
edit("src/app/[lang]/layout.tsx", [
    ('else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}`;',
     'else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}try{var a=JSON.parse(localStorage.getItem("a11y")||"null");if(a){var r=document.documentElement;if(a.font==="lg"||a.font==="xl")r.dataset.font=a.font;if(a.contrast===true)r.dataset.contrast="high";if(a.motion===true)r.dataset.motion="reduce"}}catch(e){}`;'),
])

# ---- header ----
edit("src/components/header.tsx", [
    ('import { ThemeToggle } from "./theme-toggle";', 'import { ThemeToggle } from "./theme-toggle";\nimport { AccessibilityPanel } from "./accessibility-panel";'),
    ('<nav aria-label="Main"', '<nav aria-label={dict.nav.mainLabel}'),
    ('        <div className="ml-auto flex items-center gap-2">', '        <div className="ml-auto flex flex-wrap items-center gap-2">\n          <AccessibilityPanel labels={dict.a11y} />'),
])

# ---- language names are in their own language ----
edit("src/components/language-switcher.tsx", [
    ('import { locales, localeLabels, type Locale } from "@/i18n/config";', 'import { locales, localeLabels, htmlLang, type Locale } from "@/i18n/config";'),
    ('<option key={l} value={l}>', '<option key={l} value={l} lang={htmlLang[l]}>'),
])

# ---- localized landmark labels ----
edit("src/components/admin-shell.tsx", [('<nav aria-label="Admin"', '<nav aria-label={dict.admin.nav.label}')])
edit("src/components/pager.tsx", [
    ("  labels,\n}: {", "  labels,\n  ariaLabel,\n}: {"),
    ("  labels: { prev: string; next: string; total: string };\n}) {", "  labels: { prev: string; next: string; total: string };\n  ariaLabel: string;\n}) {"),
    ('<nav aria-label="Pagination"', "<nav aria-label={ariaLabel}"),
])
edit("src/app/[lang]/projects/page.tsx", [("labels={t.pager} />", "labels={t.pager} ariaLabel={dict.nav.pagination} />")])
edit("src/app/[lang]/admin/invest/page.tsx", [("labels={t.pager} />", "labels={t.pager} ariaLabel={dict.nav.pagination} />")])
edit("src/app/[lang]/admin/requests/page.tsx", [("labels={dict.admin.invest.pager} />", "labels={dict.admin.invest.pager} ariaLabel={dict.nav.pagination} />")])

# ---- dictionaries ----
uz = {
    "a11y": {
        "open": "Qulaylik", "title": "Ko‘rish qulayligi sozlamalari", "fontSize": "Matn o‘lchami",
        "fontMd": "A", "fontLg": "A+", "fontXl": "A++",
        "contrast": "Yuqori kontrast", "motion": "Animatsiyalarni o‘chirish", "reset": "Asl holatga qaytarish", "close": "Yopish",
    },
    "mainLabel": "Asosiy menyu", "pagination": "Sahifalar", "adminLabel": "Boshqaruv bo‘limlari",
}
ru = {
    "a11y": {
        "open": "Доступность", "title": "Настройки для слабовидящих", "fontSize": "Размер текста",
        "fontMd": "A", "fontLg": "A+", "fontXl": "A++",
        "contrast": "Высокая контрастность", "motion": "Отключить анимации", "reset": "Сбросить", "close": "Закрыть",
    },
    "mainLabel": "Основное меню", "pagination": "Страницы", "adminLabel": "Разделы управления",
}
en = {
    "a11y": {
        "open": "Accessibility", "title": "Accessibility settings", "fontSize": "Text size",
        "fontMd": "A", "fontLg": "A+", "fontXl": "A++",
        "contrast": "High contrast", "motion": "Turn off animations", "reset": "Reset", "close": "Close",
    },
    "mainLabel": "Main menu", "pagination": "Pages", "adminLabel": "Admin sections",
}
oz = tr_obj(uz)
oz["a11y"]["fontMd"], oz["a11y"]["fontLg"], oz["a11y"]["fontXl"] = "A", "A+", "A++"

for lang, extra in (("uz", uz), ("oz", oz), ("ru", ru), ("en", en)):
    dp = root + f"src/i18n/dictionaries/{lang}.json"
    d = json.load(open(dp, encoding="utf8"))
    d["a11y"] = extra["a11y"]
    d["nav"]["mainLabel"] = extra["mainLabel"]
    d["nav"]["pagination"] = extra["pagination"]
    d["admin"]["nav"]["label"] = extra["adminLabel"]
    with open(dp, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
