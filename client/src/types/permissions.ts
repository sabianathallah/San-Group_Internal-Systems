export type Scope = 'none' | 'own' | 'division' | 'all';
export type AudienceScope = 'none' | 'division' | 'all';

export interface TaskPerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope; viewPrivate: boolean;
  editAssignedFully: boolean;
}
export interface BulletinPerms {
  view: boolean; create: boolean; audienceScope: AudienceScope; edit: Scope; delete: Scope;
}
export interface DbLinkPerms {
  view: Scope; addLink: boolean; manageFolder: boolean; shareFolder: boolean;
}
export interface NotePerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope;
}
export interface AnalyticsPerms {
  view: Scope;
}
export interface AuditLogPerms {
  view: Scope;
}
export interface HrisPerms {
  reviewLeave: Scope;
  editAttendance: Scope;
  manageShifts: boolean;
  manageLocations: boolean;
  viewReports: Scope;
}
export interface WorkOrderPerms {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
  // Whether this role is eligible to be picked as a technician/executor.
  // Enforced server-side too — this isn't just a UI toggle.
  canBeAssignee: boolean;
}
export interface InventoryPerms {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
  approvePurchase: boolean;
  approveDisposal: boolean;
  approveTransfer: boolean;
}
export interface TenantPerms {
  view: Scope;
  create: boolean;
  edit: Scope;
  delete: Scope;
  viewFinancials: boolean;
}
export interface MeetingRoomPerms {
  // Plain boolean, not Scope — everyone who can use the shared booking
  // calendar needs to see every booking, or it can't show what's free.
  view: boolean;
  create: boolean;
  edit: Scope;
  delete: Scope;
  manageRooms: boolean;
}
export interface UserMgmtPerms {
  create: boolean;
  edit: Scope;
  delete: Scope;
  toggleStatus: Scope;
}
export interface RoleMgmtPerms {
  create: boolean;
  edit: Scope;
  delete: Scope;
}
export interface DivisionMgmtPerms {
  create: boolean;
  edit: Scope;
  delete: Scope;
}
export interface PermissionConfig {
  task: TaskPerms;
  bulletin: BulletinPerms;
  db_link: DbLinkPerms;
  note: NotePerms;
  analytics: AnalyticsPerms;
  audit_log: AuditLogPerms;
  hris: HrisPerms;
  work_order: WorkOrderPerms;
  inventory: InventoryPerms;
  tenant: TenantPerms;
  meeting_room: MeetingRoomPerms;
  user_mgmt: UserMgmtPerms;
  role_mgmt: RoleMgmtPerms;
  division_mgmt: DivisionMgmtPerms;
}

export const DEFAULT_PERMS: PermissionConfig = {
  task:       { view: 'own', create: true, edit: 'own', delete: 'own', viewPrivate: false, editAssignedFully: false },
  bulletin:   { view: true, create: false, audienceScope: 'none', edit: 'none', delete: 'none' },
  db_link:    { view: 'own', addLink: false, manageFolder: false, shareFolder: false },
  note:       { view: 'own', create: true, edit: 'own', delete: 'own' },
  analytics:  { view: 'none' },
  audit_log:  { view: 'none' },
  hris:       { reviewLeave: 'none', editAttendance: 'none', manageShifts: false, manageLocations: false, viewReports: 'none' },
  work_order: { view: 'own', create: true, edit: 'own', delete: 'own', canBeAssignee: true },
  inventory:  { view: 'none', create: false, edit: 'none', delete: 'none', approvePurchase: false, approveDisposal: false, approveTransfer: false },
  tenant:     { view: 'none', create: false, edit: 'none', delete: 'none', viewFinancials: false },
  meeting_room: { view: true, create: true, edit: 'own', delete: 'own', manageRooms: false },
  user_mgmt:     { create: false, edit: 'none', delete: 'none', toggleStatus: 'none' },
  role_mgmt:     { create: false, edit: 'none', delete: 'none' },
  division_mgmt: { create: false, edit: 'none', delete: 'none' },
};
