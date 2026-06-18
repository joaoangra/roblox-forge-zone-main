export type StaffRole =
  | "owner"
  | "admin"
  | "staff"
  | "helper"
  | "moderator"
  | "support"
  | "official_seller"
  | "seller";

export const OWNER_PERMISSIONS = ["*"];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  helper: "Helper",
  moderator: "Moderador",
  support: "Suporte",
  official_seller: "Vendedor Oficial",
  seller: "Vendedor",
};

export const ROLE_LEVEL: Record<StaffRole, number> = {
  owner: 100,
  admin: 80,
  moderator: 65,
  staff: 55,
  support: 35,
  helper: 25,
  official_seller: 20,
  seller: 10,
};

export const PERMISSIONS = [
  "dashboard.read",
  "tickets.read",
  "tickets.respond",
  "tickets.resolve",
  "tickets.assign",
  "users.read",
  "users.edit",
  "users.suspend",
  "users.ban",
  "users.delete",
  "users.reset_password",
  "users.roles",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",
  "content.edit",
  "shop.products.manage",
  "shop.smiley.manage",
  "shop.products.read_all",
  "listings.approve",
  "listings.reject",
  "logs.read",
  "staff.manage",
  "settings.read",
  "settings.write",
  "technical.read",
  "finance.read",
  "finance.refund",
  "finance.approve",
  "disputes.resolve",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function defaultPermissions(role: string): string[] {
  switch (role) {
    case "owner":
      return OWNER_PERMISSIONS;
    case "admin":
    case "moderator":
      return [
        "dashboard.read",
        "tickets.read",
        "tickets.respond",
        "tickets.resolve",
        "tickets.assign",
        "users.read",
        "users.edit",
        "users.suspend",
        "users.ban",
        "announcements.create",
        "announcements.edit",
        "announcements.delete",
        "content.edit",
        "shop.products.manage",
        "shop.products.read_all",
        "listings.approve",
        "listings.reject",
        "logs.read",
        "technical.read",
        "disputes.resolve",
      ];
    case "support":
    case "helper":
      return [
        "dashboard.read",
        "tickets.read",
        "tickets.respond",
        "tickets.resolve",
      ];
    case "staff":
      return ["dashboard.read", "tickets.read", "tickets.respond", "tickets.resolve", "logs.read"];
    case "official_seller":
      return ["shop.products.manage", "shop.smiley.manage"];
    case "seller":
      return ["shop.products.manage"];
    default:
      return [];
  }
}

export function isKnownStaffRole(role: string): role is StaffRole {
  return role in ROLE_LEVEL;
}

export function isOwnerOnlyPermission(permission: string) {
  return (
    permission.startsWith("finance.") ||
    permission.startsWith("settings.") ||
    permission === "staff.manage"
  );
}

export const OWNER_ONLY_PERMISSIONS = PERMISSIONS.filter(isOwnerOnlyPermission);

export function canUsePermission(input: {
  isOwner: boolean;
  staffRole?: string | null;
  permissions?: string[] | null;
  permission: string;
}) {
  if (input.isOwner) return true;
  if (isOwnerOnlyPermission(input.permission)) return false;
  if (!input.staffRole) return false;

  const permissions =
    input.permissions && input.permissions.length > 0
      ? input.permissions
      : defaultPermissions(input.staffRole);

  return permissions.includes("*") || permissions.includes(input.permission);
}
