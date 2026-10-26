/** Replaces {name} markers in one pass, so a value that itself contains "{x}" is never expanded again. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Subjects go into mail headers, so line breaks must never survive (header injection). */
export function sanitizeSubject(subject: string): string {
  // \p{Zl} and \p{Zp} are the Unicode line and paragraph separators.
  return subject.replace(/[\r\n\p{Zl}\p{Zp}]+/gu, " ").trim().slice(0, 200);
}

/** Short quote of a message for an email body: collapsed whitespace, cut on a word boundary. */
export function excerpt(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

export type MailTemplate = { subject: string; body: string };

export function renderMail(template: MailTemplate, vars: Record<string, string | number>): MailTemplate {
  return { subject: sanitizeSubject(fillTemplate(template.subject, vars)), body: fillTemplate(template.body, vars) };
}
