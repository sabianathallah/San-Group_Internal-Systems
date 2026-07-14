import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';

import { uuidParamSchema } from '@/validations/common.validation';
import {
  checkInSchema, checkOutSchema, updateAttendanceSchema,
  attendanceFilterSchema, createLeaveRequestSchema,
  reviewLeaveRequestSchema, leaveFilterSchema,
  createShiftSchema, updateShiftSchema, assignShiftSchema,
  createOfficeLocationSchema, updateOfficeLocationSchema,
  reportsFilterSchema,
  createHolidaySchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  createShiftChangeSchema,
  reviewRequestSchema,
  requestFilterSchema,
  createLateExcuseSchema,
  grantCompOffSchema,
} from '@/validations/hris.validation';
import {
  listLeaveTypes, createLeaveType, updateLeaveType, getLeaveBalances,
  listLeaveRequests, createLeaveRequest, reviewLeaveRequest, cancelLeaveRequest,
  getTodayAttendance, checkIn, checkOut, listAttendance, getAttendanceSummary, updateAttendance,
  listShifts, createShift, updateShift, deleteShift, assignShift, listUsersForShift,
  listOfficeLocations, createOfficeLocation, updateOfficeLocation, deleteOfficeLocation,
  getAttendanceReports,
  listHolidays,
  createHoliday,
  deleteHoliday,
  listShiftChangeRequests,
  createShiftChangeRequest,
  reviewShiftChangeRequest,
  cancelShiftChangeRequest,
  listLateExcuseRequests,
  createLateExcuseRequest,
  reviewLateExcuseRequest,
  cancelLateExcuseRequest,
  grantCompOff,
  listCompOffGrants,
} from '@/controllers/hris.controller';

const router = Router();
router.use(authenticate);

// ── Leave ──────────────────────────────────────────────────────
router.get('/leave-types',    listLeaveTypes);
router.post('/leave-types',    checkPerm('hris', 'manageShifts'), validate(createLeaveTypeSchema), createLeaveType);
router.put ('/leave-types/:id', checkPerm('hris', 'manageShifts'), validate(uuidParamSchema, ['params']), validate(updateLeaveTypeSchema), updateLeaveType);
router.get('/leave-balances', getLeaveBalances);
router.get('/leave-requests', validate(leaveFilterSchema, ['query']), listLeaveRequests);
router.post('/leave-requests', validate(createLeaveRequestSchema), createLeaveRequest);
router.patch('/leave-requests/:id/review', checkPerm('hris', 'reviewLeave'),   validate(uuidParamSchema, ['params']), validate(reviewLeaveRequestSchema), reviewLeaveRequest);
router.patch('/leave-requests/:id/cancel', validate(uuidParamSchema, ['params']), cancelLeaveRequest);

// ── Attendance ─────────────────────────────────────────────────
router.get ('/attendance/today',   getTodayAttendance);
router.get ('/attendance/summary', getAttendanceSummary);
router.get ('/attendance',         validate(attendanceFilterSchema, ['query']), listAttendance);
router.post('/attendance/check-in',  validate(checkInSchema),  checkIn);
router.post('/attendance/check-out', validate(checkOutSchema), checkOut);
router.patch('/attendance/:id', checkPerm('hris', 'editAttendance'), validate(uuidParamSchema, ['params']), validate(updateAttendanceSchema), updateAttendance);

// ── Shifts ─────────────────────────────────────────────────────
router.get   ('/shifts',        listShifts);
router.post  ('/shifts',        checkPerm('hris', 'manageShifts'), validate(createShiftSchema), createShift);
router.post  ('/shifts/assign', checkPerm('hris', 'manageShifts'), validate(assignShiftSchema), assignShift);
router.get   ('/shifts/users',  checkPerm('hris', 'manageShifts'), listUsersForShift);
router.put   ('/shifts/:id',    checkPerm('hris', 'manageShifts'), validate(uuidParamSchema, ['params']), validate(updateShiftSchema), updateShift);
router.delete('/shifts/:id',    checkPerm('hris', 'manageShifts'), validate(uuidParamSchema, ['params']), deleteShift);

// ── Office Locations ───────────────────────────────────────────
router.get   ('/office-locations',     listOfficeLocations);
router.post  ('/office-locations',     checkPerm('hris', 'manageLocations'), validate(createOfficeLocationSchema), createOfficeLocation);
router.put   ('/office-locations/:id', checkPerm('hris', 'manageLocations'), validate(uuidParamSchema, ['params']), validate(updateOfficeLocationSchema), updateOfficeLocation);
router.delete('/office-locations/:id', checkPerm('hris', 'manageLocations'), validate(uuidParamSchema, ['params']), deleteOfficeLocation);

// ── Reports ────────────────────────────────────────────────────
router.get('/reports/attendance', checkPerm('hris', 'viewReports'), validate(reportsFilterSchema, ['query']), getAttendanceReports);

// ── Holidays (company calendar) ────────────────────────────────
router.get   ('/holidays',     listHolidays);
router.post  ('/holidays',     checkPerm('hris', 'manageShifts'), validate(createHolidaySchema), createHoliday);
router.delete('/holidays/:id', checkPerm('hris', 'manageShifts'), validate(uuidParamSchema, ['params']), deleteHoliday);

// ── Shift Change Requests (timetable) ──────────────────────────
router.get  ('/shift-changes',            validate(requestFilterSchema, ['query']), listShiftChangeRequests);
router.post ('/shift-changes',            validate(createShiftChangeSchema), createShiftChangeRequest);
router.patch('/shift-changes/:id/review', checkPerm('hris', 'manageShifts'), validate(uuidParamSchema, ['params']), validate(reviewRequestSchema), reviewShiftChangeRequest);
router.patch('/shift-changes/:id/cancel', validate(uuidParamSchema, ['params']), cancelShiftChangeRequest);

// ── Late Excuse Requests (izin telat di muka) ──────────────────
router.get  ('/late-excuses',            validate(requestFilterSchema, ['query']), listLateExcuseRequests);
router.post ('/late-excuses',            validate(createLateExcuseSchema), createLateExcuseRequest);
router.patch('/late-excuses/:id/review', checkPerm('hris', 'editAttendance'), validate(uuidParamSchema, ['params']), validate(reviewRequestSchema), reviewLateExcuseRequest);
router.patch('/late-excuses/:id/cancel', validate(uuidParamSchema, ['params']), cancelLateExcuseRequest);

// ── Comp-Off Grants (ganti off) ────────────────────────────────
router.get ('/comp-off', validate(requestFilterSchema, ['query']), listCompOffGrants);
router.post('/comp-off', checkPerm('hris', 'reviewLeave'), validate(grantCompOffSchema), grantCompOff);

export default router;
