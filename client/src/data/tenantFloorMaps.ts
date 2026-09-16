// Hotspot coordinates for the interactive tenant floor-plan maps.
//
// Each pin's (xPct, yPct) is the center of its marker as a percentage of the
// underlying floor-plan image's width/height — not pixels — so it stays
// correctly positioned no matter what size the image is rendered at.
//
// Positions were hand-placed by eye against the real floor-plan images in
// client/public/tenant-maps/ (rasterized from the client's actual PDF
// layouts). They're close, not pixel-perfect surveyed coordinates — good
// enough to click the right unit, not guaranteed to trace the exact wall
// outline. `unitNo` must match a Tenant row's `unitNo` for the same
// location+block exactly, or the pin won't resolve to any tenant data.

export type TenantLocationKey = 'GREEN_TERRACE' | 'THE_AMBOJA' | 'ALOON_ALOON';

export interface FloorPin { unitNo: string; xPct: number; yPct: number }
export interface FloorMapDef { block: string; label: string; image: string; pins: FloorPin[] }

export const TENANT_FLOOR_MAPS: Record<TenantLocationKey, FloorMapDef[]> = {
  GREEN_TERRACE: [
    {
      block: 'Block A', label: 'Block A', image: '/tenant-maps/green-terrace_block-a.png',
      pins: [
        { unitNo: '1', xPct: 24.8, yPct: 50.2 },
        { unitNo: '2', xPct: 66.9, yPct: 65.3 },
        { unitNo: '3', xPct: 52.9, yPct: 48.4 },
        { unitNo: '3A', xPct: 46.8, yPct: 37.8 },
        { unitNo: '5', xPct: 41.3, yPct: 31.1 },
        { unitNo: '6', xPct: 35.8, yPct: 24.4 },
      ],
    },
    {
      block: 'Block B', label: 'Block B', image: '/tenant-maps/green-terrace_block-b.png',
      pins: [
        { unitNo: '5', xPct: 37.4, yPct: 39.8 },
        { unitNo: '6', xPct: 49.9, yPct: 46.9 },
        { unitNo: '7&8', xPct: 53, yPct: 52 },
        { unitNo: '9', xPct: 55.7, yPct: 68.4 },
      ],
    },
    {
      block: 'Block C', label: 'Block C', image: '/tenant-maps/green-terrace_block-c.png',
      pins: [
        { unitNo: '1', xPct: 31, yPct: 52.3 },
        { unitNo: '7', xPct: 46.5, yPct: 54 },
        { unitNo: '8', xPct: 49.3, yPct: 55.8 },
        { unitNo: '9', xPct: 51.5, yPct: 57.8 },
        { unitNo: 'Plaza C', xPct: 61, yPct: 80.4 },
      ],
    },
    {
      block: 'Block D', label: 'Block D', image: '/tenant-maps/green-terrace_block-d.png',
      pins: [
        { unitNo: '1', xPct: 30.9, yPct: 44.9 },
        { unitNo: '2', xPct: 34.8, yPct: 44.9 },
        { unitNo: '3', xPct: 38.5, yPct: 44.9 },
        { unitNo: '5', xPct: 41.5, yPct: 44.9 },
        { unitNo: '6', xPct: 45.2, yPct: 43.6 },
        { unitNo: 'Anchor', xPct: 37.3, yPct: 67.1 },
        { unitNo: 'MM Juice', xPct: 55, yPct: 69.8 },
        { unitNo: '14', xPct: 60, yPct: 60.6 },
        { unitNo: '15', xPct: 60, yPct: 65.2 },
        { unitNo: '18', xPct: 56.4, yPct: 74.5 },
        { unitNo: '21', xPct: 32.8, yPct: 12.4 },
      ],
    },
  ],
  THE_AMBOJA: [
    {
      block: 'Lower Ground', label: 'Lower Ground', image: '/tenant-maps/the-amboja_lower-ground.png',
      pins: [
        { unitNo: '1', xPct: 27.7, yPct: 32.7 },
        { unitNo: '2', xPct: 79.1, yPct: 28.3 },
        { unitNo: '3', xPct: 92, yPct: 45.3 },
        { unitNo: '3A', xPct: 79.1, yPct: 61 },
      ],
    },
    {
      block: 'Ground Floor', label: 'Ground Floor', image: '/tenant-maps/the-amboja_ground-floor.png',
      pins: [
        { unitNo: '1', xPct: 15.4, yPct: 26.3 },
        { unitNo: '1 Studio', xPct: 29.7, yPct: 26.3 },
        { unitNo: '3', xPct: 55.4, yPct: 27.4 },
        { unitNo: '3A', xPct: 71.2, yPct: 26.3 },
        { unitNo: '5', xPct: 77.9, yPct: 57.9 },
        { unitNo: '06', xPct: 77.9, yPct: 68 },
        { unitNo: 'GF-Cafe', xPct: 77.9, yPct: 77.8 },
        { unitNo: '8', xPct: 42.7, yPct: 77.8 },
        { unitNo: '09', xPct: 28.9, yPct: 77.8 },
        { unitNo: '10', xPct: 15.4, yPct: 77.8 },
      ],
    },
    {
      block: 'Upper Ground', label: 'Upper Ground', image: '/tenant-maps/the-amboja_upper-ground.png',
      pins: [
        { unitNo: '1', xPct: 18, yPct: 16 },
        { unitNo: '2', xPct: 32, yPct: 25.5 },
        { unitNo: '3', xPct: 75.6, yPct: 28 },
        { unitNo: '3A', xPct: 75.6, yPct: 45 },
        { unitNo: '6', xPct: 75.6, yPct: 62 },
        { unitNo: '7', xPct: 75.6, yPct: 78 },
        { unitNo: '9', xPct: 26, yPct: 69 },
      ],
    },
    {
      block: '1st Floor', label: '1st Floor', image: '/tenant-maps/the-amboja_1st-floor.png',
      pins: [
        { unitNo: '1', xPct: 71, yPct: 20 },
        { unitNo: '2', xPct: 74, yPct: 53 },
        { unitNo: '5', xPct: 35, yPct: 67 },
        { unitNo: '3', xPct: 74, yPct: 67 },
      ],
    },
  ],
  ALOON_ALOON: [
    {
      block: 'Ground Floor', label: 'Ground Floor', image: '/tenant-maps/aloon-aloon_ground-floor.png',
      pins: [
        { unitNo: '1', xPct: 35.9, yPct: 29.5 },
        { unitNo: '2', xPct: 35.9, yPct: 43.6 },
        { unitNo: '3', xPct: 35.9, yPct: 49.5 },
        { unitNo: '8&9', xPct: 41.9, yPct: 45.7 },
        { unitNo: '5', xPct: 49.3, yPct: 29.3 },
        { unitNo: '6', xPct: 50.9, yPct: 45.2 },
        { unitNo: '7', xPct: 52.7, yPct: 65 },
        { unitNo: '3A', xPct: 35.9, yPct: 64 },
        { unitNo: '10', xPct: 59, yPct: 28.3 },
      ],
    },
    {
      block: 'Upper Ground', label: 'Upper Ground', image: '/tenant-maps/aloon-aloon_upper-ground.png',
      pins: [
        { unitNo: '1', xPct: 26.8, yPct: 28.8 },
        { unitNo: '2', xPct: 34.2, yPct: 33.3 },
        { unitNo: '3', xPct: 41.5, yPct: 33.3 },
        { unitNo: '3A', xPct: 48.8, yPct: 33.3 },
        { unitNo: '5', xPct: 56.5, yPct: 30.9 },
        { unitNo: '12A', xPct: 50.5, yPct: 48.8 },
        { unitNo: '12', xPct: 23, yPct: 69.9 },
        { unitNo: '11', xPct: 26.8, yPct: 72.6 },
        { unitNo: '10', xPct: 49.5, yPct: 72.6 },
        { unitNo: '9', xPct: 57, yPct: 78.6 },
        { unitNo: '7 (39m2)', xPct: 62.5, yPct: 42.3 },
        { unitNo: '7 Teazzi', xPct: 62.5, yPct: 49.2 },
        { unitNo: '8', xPct: 62.5, yPct: 56.4 },
      ],
    },
    {
      block: 'LT 1', label: 'LT 1', image: '/tenant-maps/aloon-aloon_lt-1.png',
      pins: [
        { unitNo: 'Cinema', xPct: 43, yPct: 31 },
        { unitNo: '1', xPct: 28.3, yPct: 64.5 },
        { unitNo: '2', xPct: 34.5, yPct: 74.1 },
        { unitNo: '3,3A&6', xPct: 56.5, yPct: 54 },
        { unitNo: '7', xPct: 79.5, yPct: 44.8 },
        { unitNo: '8', xPct: 82.5, yPct: 61.4 },
      ],
    },
  ],
};
