p = "D:/WORK/InvestMap/apps/web/src/features/map/editor/map-editor.tsx"
s = open(p, encoding="utf8").read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep('import { useMemo, useRef, useState, useTransition } from "react";', 'import { useEffect, useMemo, useRef, useState, useTransition } from "react";')
rep('  const [message, setMessage] = useState<{ type: "error" | "saved"; text: string } | null>(null);',
    '  const [message, setMessage] = useState<{ type: "error" | "saved"; text: string } | null>(null);\n  // JSON of the form as it was when editing began or was last saved, to tell if there is unsaved work.\n  const [baseline, setBaseline] = useState("");')
rep('''  function begin(next: Selected, nextDraft: Draft, bbox?: [number, number, number, number]) {
    setSelected(next);
    setDraft(nextDraft);''', '''  const dirty = selected !== null && JSON.stringify(draft) !== baseline;

  // The browser's own "leave site?" prompt covers reloads and closing the tab.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm(t.discardConfirm);

  function begin(next: Selected, nextDraft: Draft, bbox?: [number, number, number, number]) {
    setSelected(next);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));''')
rep('      setMessage({ type: "saved", text: dict.common.saved });', '      setMessage({ type: "saved", text: dict.common.saved });\n      setBaseline(JSON.stringify(draft));')
rep('''                setTab(k);
                if (selected) cancel();''', '''                if (selected && !confirmDiscard()) return;
                setTab(k);
                if (selected) cancel();''')
rep('<button type="button" onClick={cancel} className="rounded-lg border border-border bg-surface px-4 py-2">', '<button type="button" onClick={() => confirmDiscard() && cancel()} className="rounded-lg border border-border bg-surface px-4 py-2">')
open(p, "w", encoding="utf8").write(s)

# dictionary key in all four languages
import json
texts = {
    "uz": "Saqlanmagan o‘zgarishlar bor. Ularni tashlab yuborasizmi?",
    "oz": "Сақланмаган ўзгаришлар бор. Уларни ташлаб юборасизми?",
    "ru": "Есть несохранённые изменения. Отбросить их?",
    "en": "You have unsaved changes. Discard them?",
}
for lang, text in texts.items():
    dp = f"D:/WORK/InvestMap/apps/web/src/i18n/dictionaries/{lang}.json"
    d = json.load(open(dp, encoding="utf8"))
    d["admin"]["mapEditor"]["discardConfirm"] = text
    with open(dp, "w", encoding="utf8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
