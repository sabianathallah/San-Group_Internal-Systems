export type Scope = 'none' | 'own' | 'division' | 'all';
export type AudienceScope = 'none' | 'division' | 'all';

export interface TaskPermissions {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
  viewPrivate: boolean;
}

export interface BulletinPermissions {
  view: boolean;
  create: boolean;
  audienceScope: AudienceScope;
  edit: Scope;
  delete: Scope;
}

export interface DbLinkPermissions {
  view: Scope;
  addLink: boolean;
  manageFolder: boolean;
  shareFolder: boolean;
}

export interface NotePermissions {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
}

export interface AnalyticsPermissions {
  view: Scope;
}

export interface AuditLogPermissions {
  view: Scope;
}

export interface PermissionConfig {
  task: TaskPermissions;
  bulletin: BulletinPermissions;
  db_link: DbLinkPermissions;
  note: NotePermissions;
  analytics: AnalyticsPermissions;
  audit_log: AuditLogPermissions;
}

// Default permissions per level
export const DEFAULT_PERMISSIONS: Record<number, PermissionConfig> = {
  1: {
    task:      { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true },
    bulletin:  { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:   { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:      { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics: { view: 'all' },
    audit_log: { view: 'all' },
  },
  2: {
    task:      { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true },
    bulletin:  { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:   { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:      { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics: { view: 'all' },
    audit_log: { view: 'all' },
  },
  3: {
    task:      { view: 'division', create: true,  edit: 'division', delete: 'division', viewPrivate: true },
    bulletin:  { view: true,       create: true,  audienceScope: 'all',      edit: 'own',  delete: 'own' },
    db_link:   { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:      { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics: { view: 'division' },
    audit_log: { view: 'division' },
  },
  4: {
    task:      { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:  { view: true,       create: true,  audienceScope: 'division', edit: 'own',  delete: 'own' },
    db_link:   { view: 'division', addLink: true, manageFolder: false, shareFolder: false },
    note:      { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics: { view: 'division' },
    audit_log: { view: 'none' },
  },
  5: {
    task:      { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:  { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:   { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:      { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics: { view: 'none' },
    audit_log: { view: 'none' },
  },
  6: {
    task:      { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:  { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:   { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:      { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics: { view: 'none' },
    audit_log: { view: 'none' },
  },
};
