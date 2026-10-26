"use client";

import { useSyncExternalStore } from "react";
import { Select } from "@/components/form-controls";

type Labels = { label: string; light: string; dark: string; system: string };
type Choice = "light" | "dark" | "system";

function read(): Choice {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function apply(choice: Choice) {
  const dark =
    choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    if (choice === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", choice);
  } catch {}
  window.dispatchEvent(new Event("theme-change"));
}

function subscribe(cb: () => void) {
  window.addEventListener("theme-change", cb);
  return () => window.removeEventListener("theme-change", cb);
}

export function ThemeToggle({ labels }: { labels: Labels }) {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as Choice);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{labels.label}</span>
      <Select
        value={choice}
        onChange={(e) => apply(e.target.value as Choice)}
       size="sm">
        <option value="system">{labels.system}</option>
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
      </Select>
    </label>
  );
}
