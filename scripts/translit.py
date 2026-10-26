"""Uzbek Latin -> Cyrillic transliteration plus fixes for common loanwords."""

APOS = "‘ʻ'`"
SIMPLE = {
    "a": "а", "b": "б", "c": "ц", "d": "д", "f": "ф", "g": "г", "h": "ҳ", "i": "и",
    "j": "ж", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "q": "қ",
    "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "w": "в", "x": "х", "y": "й", "z": "з",
}
FIXES = [
    ("инвеститсия", "инвестиция"), ("Инвеститсия", "Инвестиция"),
    ("ауксион", "аукцион"), ("Ауксион", "Аукцион"), ("йер", "ер"), ("Йер", "Ер"),
    ("обйект", "объект"), ("Обйект", "Объект"), ("УСД", "USD"),
    ("ГеоЖСОН", "GeoJSON"), ("геожсон", "geojson"), ("ЖСОН", "JSON"), ("жсон", "json"), ("Геожсон", "GeoJSON"),
    ("ЦСВ", "CSV"), ("ИнвестМап", "InvestMap"), ("Инвестмап", "InvestMap"),
]


def _cap(src, out):
    return out.capitalize() if src[0].isupper() else out


import re

_PLACEHOLDER = re.compile(r"(\{[a-zA-Z]+\}|https?://\S+)")


def translit(s):
    """Transliterates text but leaves {placeholders} and URLs exactly as they are."""
    parts = _PLACEHOLDER.split(s)
    if len(parts) > 1:
        return "".join(part if i % 2 else _translit_plain(part) for i, part in enumerate(parts))
    return _translit_plain(s)


def _translit_plain(s):
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        low = c.lower()
        nxt = s[i + 1] if i + 1 < n else ""
        nl = nxt.lower()
        two = s[i:i + 2].lower()
        if low in "og" and nxt and nxt in APOS:
            out.append(_cap(c, "ў" if low == "o" else "ғ")); i += 2; continue
        if two == "sh":
            out.append(_cap(c, "ш")); i += 2; continue
        if two == "ch":
            out.append(_cap(c, "ч")); i += 2; continue
        if two == "ng":
            out.append(_cap(c, "нг")); i += 2; continue
        if low == "y" and nl in ("o", "u", "a") and nl != "":
            if not (nl == "o" and i + 2 < n and s[i + 2] in APOS):
                out.append(_cap(c, {"o": "ё", "u": "ю", "a": "я"}[nl])); i += 2; continue
        if low == "e":
            prev = s[i - 1] if i else " "
            out.append(_cap(c, "е" if prev.isalpha() else "э")); i += 1; continue
        if c == "’":
            out.append("ъ"); i += 1; continue
        if low in SIMPLE:
            out.append(_cap(c, SIMPLE[low])); i += 1; continue
        out.append(c); i += 1
    result = "".join(out)
    for a, b in FIXES:
        result = result.replace(a, b)
    return result


def tr_obj(o):
    if isinstance(o, str):
        return translit(o)
    if isinstance(o, list):
        return [tr_obj(x) for x in o]
    return {k: tr_obj(v) for k, v in o.items()}
