import TenantDatabaseView from '@/components/tenant/TenantDatabaseView';

// Pure information — no Tenant Baru button, no Edit/Delete, no logo upload
// anywhere on this page. CRUD lives on its own page (TenantManagePage),
// reached via the "Kelola Tenant" nav item, so a viewer browsing the
// directory is never shown a mutating control by mistake.
export default function TenantPage() {
  return <TenantDatabaseView mode="view" />;
}
