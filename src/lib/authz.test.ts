import assert from "node:assert/strict";
import test from "node:test";

import { canUsePermission, defaultPermissions, isOwnerOnlyPermission } from "./authz.ts";

test("owner can use every permission through wildcard ownership", () => {
  assert.equal(
    canUsePermission({
      isOwner: true,
      staffRole: "owner",
      permissions: ["*"],
      permission: "finance.refund",
    }),
    true,
  );
});

test("admin receives administrative permissions but not owner-only permissions", () => {
  const adminPermissions = defaultPermissions("admin");

  assert.equal(adminPermissions.includes("tickets.read"), true);
  assert.equal(adminPermissions.some(isOwnerOnlyPermission), false);
  assert.equal(
    canUsePermission({
      isOwner: false,
      staffRole: "admin",
      permissions: adminPermissions,
      permission: "settings.write",
    }),
    false,
  );
});

test("regular users cannot use admin permissions", () => {
  assert.equal(
    canUsePermission({
      isOwner: false,
      staffRole: null,
      permissions: [],
      permission: "dashboard.read",
    }),
    false,
  );
});
