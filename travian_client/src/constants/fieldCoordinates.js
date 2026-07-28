// Default coordinate mapping for each of the 12 resource field types (1-12)
// This file holds the coordinates of 18 slots for each village resource field type.
// You can edit coordinates for each field type individually below!

export const DEFAULT_COORDINATES = {
  // 1-4: Woodcutter, 5-8: Clay Pit, 9-12: Iron Mine, 13-18: Cropland
  1: { x: 260, y: 270 },
  2: { x: 370, y: 55 },
  3: { x: 275, y: 225 },
  4: { x: 155, y: 40 },
  5: { x: 230, y: 90 },
  6: { x: 185, y: 245 },
  7: { x: 290, y: 90 },
  8: { x: 350, y: 250 },
  9: { x: 430, y: 110 },
  10: { x: 120, y: 100 },
  11: { x: 350, y: 90 },
  12: { x: 380, y: 105 },
  13: { x: 110, y: 155 },
  14: { x: 80, y: 190 },
  15: { x: 245, y: 40 },
  16: { x: 370, y: 155 },
  17: { x: 395, y: 185 },
  18: { x: 150, y: 165 },
};

export const FIELD_COORDINATES = {
  // Field type 1: 3-3-3-9
  1: {
    ...DEFAULT_COORDINATES
  },
  // Field type 2: 3-4-5-6
  2: {
    ...DEFAULT_COORDINATES
  },
  // Field type 3: 4-4-4-6 (Default village)
  3: {
    ...DEFAULT_COORDINATES
  },
  // Field type 4: 4-5-3-6
  4: {
    ...DEFAULT_COORDINATES
  },
  // Field type 5: 5-3-4-6
  5: {
    ...DEFAULT_COORDINATES
  },
  // Field type 6: 1-1-1-15
  6: {
    ...DEFAULT_COORDINATES
  },
  // Field type 7: 4-4-3-7
  7: {
    ...DEFAULT_COORDINATES
  },
  // Field type 8: 3-4-4-7
  8: {
    ...DEFAULT_COORDINATES
  },
  // Field type 9: 4-3-4-7
  9: {
    ...DEFAULT_COORDINATES
  },
  // Field type 10: 3-5-4-6
  10: {
    ...DEFAULT_COORDINATES
  },
  // Field type 11: 4-3-5-6
  11: {
    ...DEFAULT_COORDINATES
  },
  // Field type 12: 5-4-3-6
  12: {
    ...DEFAULT_COORDINATES
  }
};

/**
 * Helper to get the 18 slot coordinates for a given field type (1-12).
 * Falls back to field type 3 (the standard 4-4-4-6 layout) coordinates if not found.
 * @param {number|string} fieldType
 * @returns {object} Coordinates dictionary for slots 1-18
 */
export function getCoordinatesForFieldType(fieldType) {
  return FIELD_COORDINATES[fieldType] || FIELD_COORDINATES[3] || DEFAULT_COORDINATES;
}
