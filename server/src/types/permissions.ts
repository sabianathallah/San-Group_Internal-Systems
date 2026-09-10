export type Scope = 'none' | 'own' | 'division' | 'all';
export type AudienceScope = 'none' | 'division' | 'all';

export interface TaskPermissions {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
  viewPrivate: boolean;
  /** When edit scope is 'own' and the user is only the assignee (not the
   *  creator): true lets them edit every field like before; false restricts
   *  them to status/myDay/isImportant only — the creator keeps full edit. */
  editAssignedFully: boolean;
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
  // Whether this role is eligible to be picked as a technician/executor.
  // Enforced server-side (assignee picker filter + assignment validation),
  // not just a UI toggle — a role with this false can never end up assigned,
  // even via a direct API call.
  canBeAssignee: boolean;
}

export interface InventoryPermissions {
  view: Scope;     // which assets the user can see
  create: boolean; // can create new asset records
  edit: Scope;     // edit asset master data
  delete: Scope;   // delete asset records
  // Purchase (qty in) and disposal (qty out) requests are separate approval
  // gates per the client's process: BM approves purchases, Owner approves
  // disposals. Independent booleans so a role can hold one without the other.
  approvePurchase: boolean;
  approveDisposal: boolean;
}

// NOTE: for user/role/division management, a level-ceiling rule is ALWAYS
// enforced in the service layer regardless of scope — you can never create,
// edit, delete, or assign a role to a user/role that is at or above your own
// level. Scope here only narrows *which* lower-level records you can reach
// ('division' = only within your own division), it never widens the ceiling.
export interface UserManagementPermissions {
  create: boolean;
  edit: Scope;         // none/division/all
  delete: Scope;       // none/division/all
  toggleStatus: Scope; // none/division/all — activate/deactivate account
}

export interface RoleManagementPermissions {
  create: boolean;
  edit: Scope;   // none/division/all
  delete: Scope; // none/division/all
}

export interface DivisionManagementPermissions {
  create: boolean;
  edit: Scope;   // none/division/all — 'division' means only your own division
  delete: Scope; // none/division/all
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
  inventory: InventoryPermissions;
  user_mgmt: UserManagementPermissions;
  role_mgmt: RoleManagementPermissions;
  division_mgmt: DivisionManagementPermissions;
}

// Default permissions per level — matches previous hardcoded behaviour
export const DEFAULT_PERMISSIONS: Record<number, PermissionConfig> = {
  1: {
    task:       { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true, editAssignedFully: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:    { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics:  { view: 'all' },
    audit_log:  { view: 'all' },
    hris:       { reviewLeave: 'all',  editAttendance: 'all',  manageShifts: true,  manageLocations: true,  viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all', canBeAssignee: true },
    inventory:  { view: 'all', create: true, edit: 'all', delete: 'all', approvePurchase: true, approveDisposal: true },
    user_mgmt:     { create: true, edit: 'all', delete: 'all', toggleStatus: 'all' },
    role_mgmt:     { create: true, edit: 'all', delete: 'all' },
    division_mgmt: { create: true, edit: 'all', delete: 'all' },
  },
  2: {
    task:       { view: 'all',      create: true,  edit: 'all',      delete: 'all',      viewPrivate: true, editAssignedFully: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'all',  delete: 'all' },
    db_link:    { view: 'all',      addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'all',      create: true,  edit: 'all',      delete: 'all' },
    analytics:  { view: 'all' },
    audit_log:  { view: 'all' },
    hris:       { reviewLeave: 'all',  editAttendance: 'all',  manageShifts: true,  manageLocations: true,  viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all', canBeAssignee: true },
    // Admin gets full inventory access out of the box — "hanya Admin dan BM"
    // per the contract. Managers (level 4, incl. Property Manager) start
    // locked out below; an Admin opts a specific manager in via this page.
    inventory:  { view: 'all', create: true, edit: 'all', delete: 'all', approvePurchase: true, approveDisposal: true },
    // toggleStatus/delete default to 'none' here — matches the previous hardcoded
    // behaviour where only the true SUPER_ADMIN slug could deactivate/delete users.
    user_mgmt:     { create: true, edit: 'all', delete: 'none', toggleStatus: 'none' },
    role_mgmt:     { create: true, edit: 'all', delete: 'all' },
    division_mgmt: { create: true, edit: 'all', delete: 'all' },
  },
  3: {
    task:       { view: 'division', create: true,  edit: 'division', delete: 'division', viewPrivate: true, editAssignedFully: true },
    bulletin:   { view: true,       create: true,  audienceScope: 'all',      edit: 'own',  delete: 'own' },
    db_link:    { view: 'division', addLink: true, manageFolder: true, shareFolder: true },
    note:       { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'division' },
    audit_log:  { view: 'division' },
    hris:       { reviewLeave: 'all',  editAttendance: 'all',  manageShifts: false, manageLocations: false, viewReports: 'all' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all', canBeAssignee: true },
    inventory:  { view: 'all', create: false, edit: 'none', delete: 'none', approvePurchase: false, approveDisposal: false },
    user_mgmt:     { create: false, edit: 'none', delete: 'none', toggleStatus: 'none' },
    role_mgmt:     { create: false, edit: 'none', delete: 'none' },
    division_mgmt: { create: false, edit: 'none', delete: 'none' },
  },
  4: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false, editAssignedFully: false },
    bulletin:   { view: true,       create: true,  audienceScope: 'division', edit: 'own',  delete: 'own' },
    db_link:    { view: 'division', addLink: true, manageFolder: false, shareFolder: false },
    note:       { view: 'division', create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'division' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'division',  editAttendance: 'division',  manageShifts: false, manageLocations: false, viewReports: 'division' },
    work_order: { view: 'all', create: true, edit: 'all', delete: 'all', canBeAssignee: true },
    // Locked out by default even for level-4 managers, since this level is
    // shared by 6 different manager roles (Property, Finance, Leasing, Legal,
    // HR, FnB, GA) and only Property Manager should get inventory access —
    // an Admin opts them in individually via the Permission page.
    inventory:  { view: 'none', create: false, edit: 'none', delete: 'none', approvePurchase: false, approveDisposal: false },
    user_mgmt:     { create: false, edit: 'none', delete: 'none', toggleStatus: 'none' },
    role_mgmt:     { create: false, edit: 'none', delete: 'none' },
    division_mgmt: { create: false, edit: 'none', delete: 'none' },
  },
  5: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false, editAssignedFully: false },
    bulletin:   { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:    { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:       { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'none' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'none', editAttendance: 'none', manageShifts: false, manageLocations: false, viewReports: 'none' },
    work_order: { view: 'own', create: true, edit: 'own', delete: 'own', canBeAssignee: true },
    inventory:  { view: 'none', create: false, edit: 'none', delete: 'none', approvePurchase: false, approveDisposal: false },
    user_mgmt:     { create: false, edit: 'none', delete: 'none', toggleStatus: 'none' },
    role_mgmt:     { create: false, edit: 'none', delete: 'none' },
    division_mgmt: { create: false, edit: 'none', delete: 'none' },
  },
  6: {
    task:       { view: 'division', create: true,  edit: 'own',      delete: 'own',      viewPrivate: false, editAssignedFully: false },
    bulletin:   { view: true,       create: false, audienceScope: 'none',     edit: 'none', delete: 'none' },
    db_link:    { view: 'division', addLink: false, manageFolder: false, shareFolder: false },
    note:       { view: 'own',      create: true,  edit: 'own',      delete: 'own' },
    analytics:  { view: 'none' },
    audit_log:  { view: 'none' },
    hris:       { reviewLeave: 'none', editAttendance: 'none', manageShifts: false, manageLocations: false, viewReports: 'none' },
    work_order: { view: 'own', create: true, edit: 'own', delete: 'own', canBeAssignee: true },
    inventory:  { view: 'none', create: false, edit: 'none', delete: 'none', approvePurchase: false, approveDisposal: false },
    user_mgmt:     { create: false, edit: 'none', delete: 'none', toggleStatus: 'none' },
    role_mgmt:     { create: false, edit: 'none', delete: 'none' },
    division_mgmt: { create: false, edit: 'none', delete: 'none' },
  },
};
