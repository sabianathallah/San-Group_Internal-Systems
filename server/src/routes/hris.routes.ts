import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';

import { uuidParamSchema } from '@/validations/common.validation';
import {
  checkInSchema, checkOutSchema, updateAttendanceSchema,
  attendanceFilterSchema, createLeaveRequestSchema,
  reviewLeaveRequestSchema, leaveFilterSchema,
  createShiftSchema, updateShiftSchema, assignShiftSchema,
  createOfficeLocationSchema, updateOfficeLocationSchema,
  createOvertimeSchema, reviewOvertimeSchema, overtimeFilterSchema,
  reportsFilterSchema,
} from '@/validations/hris.validation';
import {
  listLeaveTypes, getLeaveBalances,
  listLeaveRequests, createLeaveRequest, reviewLeaveRequest, cancelLeaveRequest,
  getTodayAttendance, checkIn, checkOut, listAttendance, getAttendanceSummary, updateAttendance,
  listShifts, createShift, updateShift, deleteShift, assignShift, listUsersForShift,
  listOfficeLocations, createOfficeLocation, updateOfficeLocation, deleteOfficeLocation,
  listOvertimes, createOvertime, reviewOvertime, cancelOvertime,
  getAttendanceReports,
} from '@/controllers/hris.controller';

const router = Router();
router.use(authenticate);

// ── Leave ──────────────────────────────────────────────────────
router.get('/leave-types',                                  listLeaveTypes);
router.get('/leave-balances',                               getLeaveBalances);
router.get('/leave-requests',  validate(leaveFilterSchema, ['query']),   listLeaveRequests);
router.post('/leave-requests', validate(createLeaveRequestSchema),        createLeaveRequest);
router.patch('/leave-requests/:id/review', validate(uuidParamSchema, ['params']), validate(reviewLeaveRequestSchema), reviewLeaveRequest);
router.patch('/leave-requests/:id/cancel', validate(uuidParamSchema, ['params']), cancelLeaveRequest);

// ── Attendance ─────────────────────────────────────────────────
router.get ('/attendance/today',   getTodayAttendance);
router.get ('/attendance/summary', getAttendanceSummary);
router.get ('/attendance',         validate(attendanceFilterSchema, ['query']), listAttendance);
router.post('/attendance/check-in', validate(checkInSchema), checkIn);
router.post('/attendance/check-out', validate(checkOutSchema), checkOut);
router.patch('/attendance/:id',      validate(uuidParamSchema, ['params']), validate(updateAttendanceSchema), updateAttendance);

// ── Shifts ─────────────────────────────────────────────────────
router.get   ('/shifts',         listShifts);
router.post  ('/shifts',         validate(createShiftSchema),   createShift);
router.post  ('/shifts/assign',  validate(assignShiftSchema),   assignShift);
router.get   ('/shifts/users',   listUsersForShift);
router.put   ('/shifts/:id',     validate(uuidParamSchema, ['params']), validate(updateShiftSchema),  updateShift);
router.delete('/shifts/:id',     validate(uuidParamSchema, ['params']), deleteShift);

// ── Office Locations ───────────────────────────────────────────
router.get   ('/office-locations',     listOfficeLocations);
router.post  ('/office-locations',     validate(createOfficeLocationSchema), createOfficeLocation);
router.put   ('/office-locations/:id', validate(uuidParamSchema, ['params']), validate(updateOfficeLocationSchema), updateOfficeLocation);
router.delete('/office-locations/:id', validate(uuidParamSchema, ['params']), deleteOfficeLocation);

// ── Overtime ───────────────────────────────────────────────────
router.get   ('/overtime',              validate(overtimeFilterSchema, ['query']), listOvertimes);
router.post  ('/overtime',              validate(createOvertimeSchema), createOvertime);
router.patch ('/overtime/:id/review',   validate(uuidParamSchema, ['params']), validate(reviewOvertimeSchema), reviewOvertime);
router.patch ('/overtime/:id/cancel',   validate(uuidParamSchema, ['params']), cancelOvertime);

// ── Reports ────────────────────────────────────────────────────
router.get('/reports/attendance', validate(reportsFilterSchema, ['query']), getAttendanceReports);

export default router;
