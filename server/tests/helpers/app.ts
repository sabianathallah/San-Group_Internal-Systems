/**
 * Ekspor Express app (tanpa listen) untuk dipakai Supertest.
 * Server tidak di-start — Supertest bind sendiri ke port acak.
 */
export { default } from '../../src/app';
