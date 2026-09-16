import TenantDatabaseView from '@/components/tenant/TenantDatabaseView';

// Same list/map/stats as Database Tenant, but with Tenant Baru + Edit/Delete
// enabled — a separate nav destination on purpose (see TenantPage.tsx),
// gated by the sidebar to only users holding a tenant create/edit/delete
// permission.
export default function TenantManagePage() {
  return <TenantDatabaseView mode="manage" />;
}
