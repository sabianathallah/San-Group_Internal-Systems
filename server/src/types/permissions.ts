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

export interface HrisPermissions {
  reviewLeave: Scope;        // approve / reject leave requests (none/division/all — self-review is always blocked)
  reviewOvertime: Scope;     // approve / reject overtime requests (none/division/all)
  editAttendance: Scope;     // admin-edit any attendance record (none/division/all)
  manageShifts: boolean;     // CRUD shifts + assign to users
  manageLocations: boolean;  // CRUD office locations
  viewReports: Scope;        // attendance reports (none/division/all)
}

export interface WorkOrderPermissions {
  view: Scope;     // which work orders the user can see
  create: boolean; // can create new work orders
  edit: Scope;     // own = only own WOs; all = all WOs
  delete: Scope;   // same
}

export interface PermissionConfig {
  task: TaskPermissions;
  bulletin: BulletinPermissions;
  db_link: DbLinkPermissions;
  note: NotePermissions;
  analytics: AnalyticsPermissions;
  audit_log: AuditLogPermissions;
  hris: HrisPermissions;
  work_order: WorkOrderPermissions;
}

// Default permissions per level — matches previous hardcoded behaviour
export const DEFAULT_PERMISSIONS: Record<number, PermissionConfig> = {
  1: {
    task:       { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:    { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics:  { view: 'all' },
    audit_log:  { view: 'all' },
    hris:       { reviewLeave: 'all',  reviewOvertime: 'all',  editAttendance: 'all',  manageShifts: true,  manageLocations: true,  viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all' },
  },
  2: {
    task:       { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:    { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics:  { view: 'all' },
    audit_log:  { view: 'all' },
    hris:       { reviewLeave: 'all',  reviewOvertime: 'all',  editAttendance: 'all',  manageShifts: true,  manageLocations: true,  viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all' },
  },
  3: {
    task:       { view: 'division', create: true,  edit: 'division', delete: 'division', viewPrivate: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'own',  delete: 'own' },
    db_link:    { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'division' },
    audit_log:  { view: 'division' },
    hris:       { reviewLeave: 'all',  reviewOvertime: 'all',  editAttendance: 'all',  manageShifts: false, manageLocations: false, viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all' },
  },
  4: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:   { view: true,       create: true,  audienceScope: 'division', edit: 'own',  delete: 'own' },
    db_link:    { view: 'division', addLink: true, manageFolder: false, shareFolder: false },
    note:       { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'division' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'division',  reviewOvertime: 'division',  editAttendance: 'division',  manageShifts: false, manageLocations: false, viewReports: 'division' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all' },
  },
  5: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:   { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:    { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:       { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'none' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'none', reviewOvertime: 'none', editAttendance: 'none', manageShifts: false, manageLocations: false, viewReports: 'none' },
    work_order: { view: 'own', create: true, edit: 'own', delete: 'own' },
  },
  6: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false },
    bulletin:   { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:    { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:       { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'none' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'none', reviewOvertime: 'none', editAttendance: 'none', manageShifts: false, manageLocations: false, viewReports: 'none' },
    work_order: { view: 'own', create: true, edit: 'own', delete: 'own' },
  },
};
