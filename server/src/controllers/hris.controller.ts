import { Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import '@/config/cloudinary';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getPermissionsForRole } from '@/services/permission.service';
import {
  listLeaveTypesService,
  getLeaveBalancesService,
  listLeaveRequestsService,
  createLeaveRequestService,
  reviewLeaveRequestService,
  cancelLeaveRequestService,
  todayAttendanceService,
  checkInService,
  checkOutService,
  listAttendanceService,
  getAttendanceSummaryService,
  adminUpdateAttendanceService,
  listShiftsService,
  createShiftService,
  updateShiftService,
  deleteShiftService,
  assignShiftService,
  listUsersForShiftService,
  listOfficeLocationsService,
  createOfficeLocationService,
  updateOfficeLocationService,
  deleteOfficeLocationService,
  getAttendanceReportsService,
  listHolidaysService,
  createHolidayService,
  deleteHolidayService,
  listShiftChangeRequestsService,
  createShiftChangeRequestService,
  reviewShiftChangeRequestService,
  cancelShiftChangeRequestService,
  listLateExcuseRequestsService,
  createLateExcuseRequestService,
  reviewLateExcuseRequestService,
  cancelLateExcuseRequestService,
  grantCompOffService,
  listCompOffGrantsService,
} from '@/services/hris.service';

// ── Leave Types ────────────────────────────────────────────────

export async function listLeaveTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const types = await listLeaveTypesService();
    successResponse(res, types, 'Jenis cuti berhasil diambil');
  } catch (err) { next(err); }
}

// ── Leave Balances ─────────────────────────────────────────────

export async function getLeaveBalances(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.query.userId as string) || req.user!.userId;
    const year   = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data   = await getLeaveBalancesService(userId, year);
    successResponse(res, data, 'Saldo cuti berhasil diambil');
  } catch (err) { next(err); }
}

// ── Leave Requests ─────────────────────────────────────────────

export async function listLeaveRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel, divisionId } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    const result = await listLeaveRequestsService(userId, perms.hris.reviewLeave, divisionId, req.query);
    successResponse(res, result.leaveRequests, 'Daftar cuti berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function createLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Supporting document (surat dokter, undangan, dll) — same base64 →
    // Cloudinary flow as the check-in photo.
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    if (req.body.attachmentBase64) {
      const result = await cloudinary.uploader.upload(req.body.attachmentBase64, {
        folder:          'san-group/leave-docs',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        public_id:       `leave_${Date.now()}`,
      });
      attachmentUrl  = result.secure_url;
      attachmentName = req.body.attachmentName ?? null;
    }
    const { attachmentBase64: _dropped, ...rest } = req.body;
    const request = await createLeaveRequestService(req.user!.userId, { ...rest, attachmentUrl, attachmentName });
    successResponse(res, request, 'Pengajuan cuti berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function reviewLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const reviewScope = req.permScope ?? 'all';
    const result = await reviewLeaveRequestService(String(req.params.id), userId, reviewScope, divisionId, req.body);
    successResponse(res, result, 'Pengajuan cuti berhasil diproses');
  } catch (err) { next(err); }
}

export async function cancelLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await cancelLeaveRequestService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'Pengajuan cuti dibatalkan');
  } catch (err) { next(err); }
}

// ── Attendance ─────────────────────────────────────────────────

export async function getTodayAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await todayAttendanceService(req.user!.userId);
    successResponse(res, record, 'Absensi hari ini berhasil diambil');
  } catch (err) { next(err); }
}

export async function checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let photoUrl: string | null = null;
    if (req.body.photoBase64) {
      const result = await cloudinary.uploader.upload(req.body.photoBase64, {
        folder:         'san-group/attendance',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto:good' }],
        public_id:      `attendance_${Date.now()}`,
      });
      photoUrl = result.secure_url;
    }
    const { photoBase64: _dropped, ...rest } = req.body;
    const record = await checkInService(req.user!.userId, { ...rest, photoUrl });
    successResponse(res, record, 'Check-in berhasil', 201);
  } catch (err) { next(err); }
}

export async function checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await checkOutService(req.user!.userId, req.body);
    successResponse(res, record, 'Check-out berhasil');
  } catch (err) { next(err); }
}

export async function listAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel, divisionId } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    const result = await listAttendanceService(userId, perms.hris.editAttendance, divisionId, req.query);
    successResponse(res, result.attendance, 'Data absensi berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getAttendanceSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.query.userId as string) || req.user!.userId;
    const now    = new Date();
    const month  = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year   = req.query.year  ? Number(req.query.year)  : now.getFullYear();
    const data   = await getAttendanceSummaryService(userId, month, year);
    successResponse(res, data, 'Ringkasan absensi berhasil diambil');
  } catch (err) { next(err); }
}

export async function updateAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { divisionId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const record = await adminUpdateAttendanceService(String(req.params.id), editScope, divisionId, req.body);
    successResponse(res, record, 'Absensi berhasil diperbarui');
  } catch (err) { next(err); }
}

// ── Shifts ─────────────────────────────────────────────────────

export async function listShifts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listShiftsService();
    successResponse(res, data, 'Daftar shift berhasil diambil');
  } catch (err) { next(err); }
}

export async function createShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createShiftService(req.body);
    successResponse(res, data, 'Shift berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateShiftService(String(req.params.id), req.body);
    successResponse(res, data, 'Shift berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteShiftService(String(req.params.id));
    successResponse(res, null, 'Shift berhasil dihapus');
  } catch (err) { next(err); }
}

export async function assignShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, shiftId } = req.body;
    const data = await assignShiftService(userId, shiftId);
    successResponse(res, data, 'Shift berhasil di-assign');
  } catch (err) { next(err); }
}

export async function listUsersForShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listUsersForShiftService();
    successResponse(res, data, 'Daftar karyawan berhasil diambil');
  } catch (err) { next(err); }
}

// ── Office Locations ───────────────────────────────────────────

export async function listOfficeLocations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listOfficeLocationsService();
    successResponse(res, data, 'Daftar lokasi kantor berhasil diambil');
  } catch (err) { next(err); }
}

export async function createOfficeLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createOfficeLocationService(req.body);
    successResponse(res, data, 'Lokasi kantor berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function updateOfficeLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateOfficeLocationService(String(req.params.id), req.body);
    successResponse(res, data, 'Lokasi kantor berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteOfficeLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteOfficeLocationService(String(req.params.id));
    successResponse(res, null, 'Lokasi kantor berhasil dihapus');
  } catch (err) { next(err); }
}

// ── Reports ────────────────────────────────────────────────────

export async function getAttendanceReports(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'all';
    const result = await getAttendanceReportsService(userId, permScope, req.query);
    successResponse(res, result, 'Laporan absensi berhasil diambil');
  } catch (err) { next(err); }
}

// ── Holidays ───────────────────────────────────────────────────

export async function listHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await listHolidaysService(year);
    successResponse(res, data, 'Daftar hari libur berhasil diambil');
  } catch (err) { next(err); }
}

export async function createHoliday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createHolidayService(req.body);
    successResponse(res, data, 'Hari libur berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function deleteHoliday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteHolidayService(String(req.params.id));
    successResponse(res, null, 'Hari libur dihapus');
  } catch (err) { next(err); }
}

// ── Shift Change Requests ──────────────────────────────────────

export async function listShiftChangeRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel, divisionId } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    // manageShifts is a boolean permission — holders review company-wide.
    const scope = perms.hris.manageShifts ? 'all' : 'own';
    const result = await listShiftChangeRequestsService(userId, scope, divisionId, req.query);
    successResponse(res, result.shiftChangeRequests, 'Daftar pengajuan shift berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function createShiftChangeRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createShiftChangeRequestService(req.user!.userId, req.body);
    successResponse(res, data, 'Pengajuan perubahan shift berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function reviewShiftChangeRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const data = await reviewShiftChangeRequestService(String(req.params.id), userId, 'all', divisionId, req.body);
    successResponse(res, data, 'Pengajuan shift berhasil diproses');
  } catch (err) { next(err); }
}

export async function cancelShiftChangeRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await cancelShiftChangeRequestService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'Pengajuan shift dibatalkan');
  } catch (err) { next(err); }
}

// ── Late Excuse Requests ───────────────────────────────────────

export async function listLateExcuseRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel, divisionId } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    const result = await listLateExcuseRequestsService(userId, perms.hris.editAttendance, divisionId, req.query);
    successResponse(res, result.lateExcuseRequests, 'Daftar izin telat berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function createLateExcuseRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createLateExcuseRequestService(req.user!.userId, req.body);
    successResponse(res, data, 'Pengajuan izin telat berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function reviewLateExcuseRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const reviewScope = req.permScope ?? 'all';
    const data = await reviewLateExcuseRequestService(String(req.params.id), userId, reviewScope, divisionId, req.body);
    successResponse(res, data, 'Pengajuan izin telat berhasil diproses');
  } catch (err) { next(err); }
}

export async function cancelLateExcuseRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await cancelLateExcuseRequestService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'Pengajuan izin telat dibatalkan');
  } catch (err) { next(err); }
}


// ── Comp-Off Grants (ganti off) ────────────────────────────────

export async function grantCompOff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await grantCompOffService(req.user!.userId, req.body);
    successResponse(res, data, 'Ganti off berhasil diberikan', 201);
  } catch (err) { next(err); }
}

export async function listCompOffGrants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel, divisionId } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    const result = await listCompOffGrantsService(userId, perms.hris.reviewLeave, divisionId, req.query);
    successResponse(res, result.grants, 'Daftar ganti off berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}
