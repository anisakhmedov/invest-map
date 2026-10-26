export const actions = ["view", "create", "update", "delete", "publish"] as const;
export type Action = (typeof actions)[number];

export const resources = [
  "page",
  "media",
  "settings",
  "map.layer",
  "map.feature",
  "invest",
  "auction",
  "request",
  "task",
  "report",
  "user",
  "role",
  "audit",
] as const;
export type Resource = (typeof resources)[number];

export const roleKeys = [
  "SUPER_ADMIN",
  "ADMIN",
  "CONTENT_EDITOR",
  "MAP_EDITOR",
  "REQUEST_MANAGER",
  "INVESTOR",
] as const;
export type RoleKey = (typeof roleKeys)[number];

type Grant = Partial<Record<Resource, readonly Action[]>>;

const all = actions;
const crud = ["view", "create", "update", "delete"] as const;

/** Default permission matrix; SUPER_ADMIN is handled as a wildcard in `can`. */
export const defaultPermissions: Record<RoleKey, Grant> = {
  SUPER_ADMIN: {},
  ADMIN: {
    page: all,
    media: all,
    settings: ["view", "update"],
    "map.layer": all,
    "map.feature": all,
    invest: all,
    auction: all,
    request: all,
    task: all,
    report: ["view", "create"],
    user: crud,
    audit: ["view"],
  },
  CONTENT_EDITOR: {
    page: all,
    media: crud,
    settings: ["view"],
  },
  MAP_EDITOR: {
    "map.layer": all,
    "map.feature": all,
    invest: ["view", "update"],
    auction: ["view", "update"],
    media: ["view", "create"],
  },
  REQUEST_MANAGER: {
    request: ["view", "update"],
    task: crud,
    report: ["view", "create"],
  },
  INVESTOR: {
    request: ["view", "create"],
  },
};

export function isRoleKey(value: string): value is RoleKey {
  return (roleKeys as readonly string[]).includes(value);
}

export function can(role: string, resource: Resource, action: Action): boolean {
  if (!isRoleKey(role)) return false;
  if (role === "SUPER_ADMIN") return true;
  return defaultPermissions[role][resource]?.includes(action) ?? false;
}

/** Roles that may open the admin panel at all. */
export function canAccessAdmin(role: string): boolean {
  return isRoleKey(role) && role !== "INVESTOR";
}
