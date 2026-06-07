import { prisma } from '@/config/database';
import { PermissionConfig, DEFAULT_PERMISSIONS } from '@/types/permissions';
import { AppError } from '@/middlewares/errorHandler.middleware';

// ── In-memory cache with TTL ──────────────────────────────────
interface CacheEntry {
  permissions: PermissionConfig;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getFromCache(roleId: string): PermissionConfig | null {
  const entry = cache.get(roleId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(roleId);
    return null;
  }
  return entry.permissions;
}

function setCache(roleId: string, permissions: PermissionConfig): void {
  cache.set(roleId, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCache(roleId: string): void {
  cache.delete(roleId);
}

// ── Get permissions for a role ────────────────────────────────
export async function getPermissionsForRole(
  roleId: string,
  roleLevel: number,
): Promise<PermissionConfig> {
  // SuperAdmin bypasses — always return full permissions
  if (roleLevel <= 1) {
    return DEFAULT_PERMISSIONS[1];
  }

  // Check cache
  const cached = getFromCache(roleId);
  if (cached) return cached;

  // Load from DB
  const record = await prisma.rolePermission.findUnique({ where: { roleId } });

  if (!record || !record.permissions || Object.keys(record.permissions as object).length === 0) {
    // Fall back to level defaults
    const defaults = DEFAULT_PERMISSIONS[roleLevel] ?? DEFAULT_PERMISSIONS[6];
    setCache(roleId, defaults);
    return defaults;
  }

  // Merge saved permissions with defaults to fill any missing feature keys
  const defaults = DEFAULT_PERMISSIONS[roleLevel] ?? DEFAULT_PERMISSIONS[6];
  const saved = record.permissions as unknown as Partial<PermissionConfig>;
  const permissions: PermissionConfig = { ...defaults, ...saved };
  setCache(roleId, permissions);
  return permissions;
}

// ── Update permissions for a role ─────────────────────────────
export async function updatePermissionsForRole(
  roleId: string,
  permissions: PermissionConfig,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError('Role tidak ditemukan', 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permsJson = permissions as any;
  const record = await prisma.rolePermission.upsert({
    where:  { roleId },
    create: { roleId, permissions: permsJson },
    update: { permissions: permsJson },
  });

  invalidateCache(roleId);
  return record;
}

// ── Get all roles with their permissions ──────────────────────
export async function getRolesWithPermissions() {
  const roles = await prisma.role.findMany({
    orderBy: [{ level: 'asc' }, { position: 'asc' }],
    include: {
      rolePermission: true,
      division: { select: { id: true, name: true, color: true } },
      _count: { select: { users: true } },
    },
  });

  return roles.map((role) => {
    const defaults = DEFAULT_PERMISSIONS[role.level] ?? DEFAULT_PERMISSIONS[6];
    let permissions: PermissionConfig;
    if (role.rolePermission && Object.keys(role.rolePermission.permissions as object).length > 0) {
      // Merge saved with defaults so new feature keys (e.g. 'note') auto-fill
      const saved = role.rolePermission.permissions as unknown as Partial<PermissionConfig>;
      permissions = { ...defaults, ...saved };
    } else {
      permissions = defaults;
    }
    return {
      id:          role.id,
      name:        role.name,
      slug:        role.slug,
      color:       role.color,
      level:       role.level,
      description: role.description,
      division:    role.division,
      _count:      role._count,
      permissions,
      hasCustomPermissions: !!role.rolePermission && Object.keys(role.rolePermission.permissions as object).length > 0,
    };
  });
}

// ── Ensure default permissions on role create ─────────────────
export async function ensureDefaultPermissions(
  roleId: string,
  roleLevel: number,
): Promise<void> {
  const existing = await prisma.rolePermission.findUnique({ where: { roleId } });
  if (existing) return;

  // We intentionally leave the record empty so level-based defaults apply.
  // This function is a no-op but can be extended to seed defaults if needed.
}
