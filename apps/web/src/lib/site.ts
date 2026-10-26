import { cacheLife, cacheTag } from "next/cache";
import { contactsSchema, type Contacts } from "./content";
import { db } from "./db";

const EMPTY: Contacts = { email: "", phone: "", address: { uz: "", oz: "", ru: "", en: "" } };

/** Cached until the contacts are saved (`updateTag("site-settings")`). */
export async function getContacts(): Promise<Contacts> {
  "use cache";
  cacheTag("site-settings");
  cacheLife("hours");
  return loadContacts();
}

/** Reads contact details from site settings; invalid or missing data yields empty values. */
export async function loadContacts(): Promise<Contacts> {
  const row = await db.siteSetting.findUnique({ where: { key: "contacts" } });
  const parsed = contactsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : EMPTY;
}
