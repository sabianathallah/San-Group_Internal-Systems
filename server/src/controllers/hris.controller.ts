import { Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import '@/config/cloudinary';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
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
  listOvertimeRequestsService,
  createOvertimeRequestService,
  reviewOvertimeRequestService,
  cancelOvertimeRequestService,
  getAttendanceReportsService,
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
    const { userId, roleLevel } = req.user!;
    const result = await listLeaveRequestsService(userId, roleLevel, req.query);
    successResponse(res, result.leaveRequests, 'Daftar cuti berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function createLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await createLeaveRequestService(req.user!.userId, req.body);
    successResponse(res, request, 'Pengajuan cuti berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function reviewLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const result = await reviewLeaveRequestService(String(req.params.id), userId, roleLevel, req.body);
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
    const { userId, roleLevel } = req.user!;
    const result = await listAttendanceService(userId, roleLevel, req.query);
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
    const record = await adminUpdateAttendanceService(String(req.params.id), req.user!.roleLevel, req.body);
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
    const data = await createShiftService(req.user!.roleLevel, req.body);
    successResponse(res, data, 'Shift berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateShiftService(String(req.params.id), req.user!.roleLevel, req.body);
    successResponse(res, data, 'Shift berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteShiftService(String(req.params.id), req.user!.roleLevel);
    successResponse(res, null, 'Shift berhasil dihapus');
  } catch (err) { next(err); }
}

export async function assignShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, shiftId } = req.body;
    const data = await assignShiftService(req.user!.roleLevel, userId, shiftId);
    successResponse(res, data, 'Shift berhasil di-assign');
  } catch (err) { next(err); }
}

export async function listUsersForShift(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listUsersForShiftService(req.user!.roleLevel);
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
    const data = await createOfficeLocationService(req.user!.roleLevel, req.body);
    successResponse(res, data, 'Lokasi kantor berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function updateOfficeLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateOfficeLocationService(String(req.params.id), req.user!.roleLevel, req.body);
    successResponse(res, data, 'Lokasi kantor berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteOfficeLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteOfficeLocationService(String(req.params.id), req.user!.roleLevel);
    successResponse(res, null, 'Lokasi kantor berhasil dihapus');
  } catch (err) { next(err); }
}

// ── Overtime ───────────────────────────────────────────────────

export async function listOvertimes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const result = await listOvertimeRequestsService(userId, roleLevel, req.query);
    successResponse(res, result.overtimes, 'Daftar lembur berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function createOvertime(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createOvertimeRequestService(req.user!.userId, req.body);
    successResponse(res, data, 'Pengajuan lembur berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function reviewOvertime(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const data = await reviewOvertimeRequestService(String(req.params.id), userId, roleLevel, req.body);
    successResponse(res, data, 'Pengajuan lembur berhasil diproses');
  } catch (err) { next(err); }
}

export async function cancelOvertime(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await cancelOvertimeRequestService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'Pengajuan lembur dibatalkan');
  } catch (err) { next(err); }
}

// ── Reports ────────────────────────────────────────────────────

export async function getAttendanceReports(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const result = await getAttendanceReportsService(userId, roleLevel, req.query);
    successResponse(res, result, 'Laporan absensi berhasil diambil');
  } catch (err) { next(err); }
}
