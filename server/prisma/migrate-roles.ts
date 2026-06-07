/**
 * One-time migration: consolidate division-specific roles into 6 generic roles.
 * Run with: npx tsx prisma/migrate-roles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Scope = 'none' | 'own' | 'division' | 'all';
const SCOPE_RANK: Record<Scope, number> = { none: 0, own: 1, division: 2, all: 3 };
const mergeScope = (a: Scope, b: Scope): Scope => {
  const scopes: Scope[] = ['none', 'own', 'division', 'all'];
  return scopes[Math.max(SCOPE_RANK[a] ?? 0, SCOPE_RANK[b] ?? 0)];
};

const GENERIC_ROLES = [
  { level: 1, name: 'Super Admin', slug: 'SUPER_ADMIN', color: '#1e293b', description: 'Akses penuh ke seluruh sistem' },
  { level: 2, name: 'Direktur',    slug: 'DIREKTUR',    color: '#7c3aed', description: 'Pimpinan organisasi, akses lintas divisi' },
  { level: 3, name: 'Manager',     slug: 'MANAGER',     color: '#0369a1', description: 'Manajemen operasional' },
  { level: 4, name: 'Kepala Divisi', slug: 'KEPALA_DIVISI', color: '#0891b2', description: 'Kepala divisi atau departemen' },
  { level: 5, name: 'Kepala Unit', slug: 'KEPALA_UNIT', color: '#059669', description: 'Kepala unit atau sub-divisi' },
  { level: 6, name: 'Staff',       slug: 'STAFF',       color: '#6366f1', description: 'Anggota tim / staf' },
];

function mergePermissions(permsArray: Record<string, unknown>[]): Record<string, unknown> {
  if (permsArray.length === 0) return {};
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(permsArray[0]));

  for (let i = 1; i < permsArray.length; i++) {
    const p = permsArray[i];
    for (const feature of Object.keys(p)) {
      if (!merged[feature]) { merged[feature] = p[feature]; continue; }
      const mf = merged[feature] as Record<string, unknown>;
      const pf = p[feature] as Record<string, unknown>;
      for (const key of Object.keys(pf)) {
        const mv = mf[key];
        const pv = pf[key];
        if (typeof mv === 'boolean' && typeof pv === 'boolean') {
          mf[key] = mv || pv;
        } else if (typeof mv === 'string' && typeof pv === 'string') {
          mf[key] = mergeScope(mv as Scope, pv as Scope);
        }
      }
    }
  }
  return merged;
}

async function main() {
  console.log('Starting role migration...\n');

  // 1. Get all existing roles with their permissions and user counts
  const existingRoles = await prisma.role.findMany({
    include: {
      rolePermission: true,
      _count: { select: { users: true } },
    },
    orderBy: [{ level: 'asc' }, { position: 'asc' }],
  });

  console.log(`Found ${existingRoles.length} existing roles`);

  // 2. Group by level
  const byLevel: Record<number, typeof existingRoles> = {};
  for (const r of existingRoles) {
    if (!byLevel[r.level]) byLevel[r.level] = [];
    byLevel[r.level].push(r);
  }

  // 3. For each generic role: upsert role + merge permissions + reassign users
  const newRoleIds: Record<number, string> = {};

  for (const generic of GENERIC_ROLES) {
    const oldRoles = byLevel[generic.level] ?? [];
    console.log(`\nLevel ${generic.level} (${generic.name}): ${oldRoles.length} old roles`);

    // Collect permissions from old roles at this level
    const permsArray = oldRoles
      .filter(r => r.rolePermission && Object.keys(r.rolePermission.permissions as object).length > 0)
      .map(r => r.rolePermission!.permissions as Record<string, unknown>);

    const mergedPerms = mergePermissions(permsArray);
    console.log(`  Merged permissions from ${permsArray.length} custom permission records`);

    // Check if the generic slug already exists
    const existing = await prisma.role.findFirst({
      where: { slug: generic.slug },
    });

    let newRole: { id: string };
    if (existing) {
      // Update name/color/description only (keep id)
      newRole = await prisma.role.update({
        where: { id: existing.id },
        data: {
          name:        generic.name,
          color:       generic.color,
          level:       generic.level,
          description: generic.description,
          divisionId:  null,
          position:    0,
        },
      });
      console.log(`  Updated existing role: ${existing.name} → ${generic.name}`);
    } else {
      newRole = await prisma.role.create({
        data: {
          name:        generic.name,
          slug:        generic.slug,
          color:       generic.color,
          level:       generic.level,
          description: generic.description,
          divisionId:  null,
          position:    0,
        },
      });
      console.log(`  Created new role: ${generic.name}`);
    }

    newRoleIds[generic.level] = newRole.id;

    // Upsert merged permissions
    if (Object.keys(mergedPerms).length > 0) {
      await prisma.rolePermission.upsert({
        where:  { roleId: newRole.id },
        create: { roleId: newRole.id, permissions: mergedPerms },
        update: { permissions: mergedPerms },
      });
      console.log(`  Saved merged permissions`);
    }

    // Reassign all users at this level to the new generic role
    const oldRoleIds = oldRoles.map(r => r.id).filter(id => id !== newRole.id);
    if (oldRoleIds.length > 0) {
      const updated = await prisma.user.updateMany({
        where: { roleId: { in: oldRoleIds } },
        data:  { roleId: newRole.id },
      });
      console.log(`  Reassigned ${updated.count} users`);
    }
  }

  // 4. Delete old roles that are no longer needed
  const newIds = Object.values(newRoleIds);
  const toDelete = await prisma.role.findMany({
    where: { id: { notIn: newIds } },
  });

  console.log(`\nDeleting ${toDelete.length} old roles...`);
  for (const r of toDelete) {
    // Delete permission record first (cascade should handle it but let's be safe)
    await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
    await prisma.role.delete({ where: { id: r.id } });
    console.log(`  Deleted: ${r.name} (L${r.level})`);
  }

  // 5. Final state
  console.log('\nFinal roles:');
  const finalRoles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { level: 'asc' },
  });
  for (const r of finalRoles) {
    console.log(`  L${r.level} | ${r.name} | ${r._count.users} users`);
  }

  console.log('\nMigration complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
