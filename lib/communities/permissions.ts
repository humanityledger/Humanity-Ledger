/**
 * Community role-based permissions.
 *
 * Roles (from highest to lowest): owner > admin > moderator > member
 */

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export type CommunityAction =
  | 'post'
  | 'delete_any_post'
  | 'invite'
  | 'kick_member'
  | 'ban_member'
  | 'manage_channels'
  | 'manage_settings'
  | 'view_analytics'
  | 'manage_roles'
  | 'delete_community'
  | 'pin_message'
  | 'create_poll'
  | 'view_modlog';

/**
 * Permission matrix: role → set of allowed actions.
 */
const PERMISSIONS: Record<CommunityRole, Set<CommunityAction>> = {
  owner: new Set([
    'post', 'delete_any_post', 'invite', 'kick_member', 'ban_member',
    'manage_channels', 'manage_settings', 'view_analytics', 'manage_roles',
    'delete_community', 'pin_message', 'create_poll', 'view_modlog',
  ]),
  admin: new Set([
    'post', 'delete_any_post', 'invite', 'kick_member', 'ban_member',
    'manage_channels', 'manage_settings', 'view_analytics',
    'pin_message', 'create_poll', 'view_modlog',
  ]),
  moderator: new Set([
    'post', 'delete_any_post', 'kick_member', 'pin_message', 'view_modlog',
  ]),
  member: new Set([
    'post', 'create_poll',
  ]),
};

/**
 * Check if a role is allowed to perform an action.
 */
export function isAllowed(role: CommunityRole, action: CommunityAction): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Assert permission, throws with 403 status if denied.
 */
export function assertPermission(role: CommunityRole | null | undefined, action: CommunityAction): void {
  if (!role || !isAllowed(role, action)) {
    const err: any = new Error(`Forbidden: '${action}' requires appropriate role`);
    err.status = 403;
    throw err;
  }
}

/**
 * Role hierarchy comparison.
 * Returns true if roleA >= roleB in authority.
 */
export function isRoleAtLeast(roleA: CommunityRole, roleB: CommunityRole): boolean {
  const ORDER: CommunityRole[] = ['member', 'moderator', 'admin', 'owner'];
  return ORDER.indexOf(roleA) >= ORDER.indexOf(roleB);
}
