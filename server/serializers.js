// Mapping rows to API shapes. Public asset views never include the staff-only reason.

export function publicAsset(a) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    condition: a.condition,
    pickupLocation: a.pickup_location,
    description: a.description,
    status: a.status,
    publicNotice: a.public_notice,
  };
}

export function staffAsset(a) {
  return {
    ...publicAsset(a),
    unavailableReason: a.unavailable_reason,
    statusChangedAt: a.status_changed_at,
    affectedCount: a.affected_count !== undefined ? Number(a.affected_count) : undefined,
  };
}

export const RESERVATION_SELECT = `
  SELECT r.*, a.name AS asset_name, a.type AS asset_type, a.pickup_location,
         a.status AS asset_status, a.public_notice,
         acc.name AS student_name, acc.email AS student_email
    FROM reservations r
    JOIN assets a ON a.id = r.asset_id
    JOIN accounts acc ON acc.id = r.account_id`;

export function reservation(r, { includeStudent = false, now = new Date() } = {}) {
  const out = {
    id: r.id,
    assetId: r.asset_id,
    assetName: r.asset_name,
    assetType: r.asset_type,
    pickupLocation: r.pickup_location,
    start: r.start_at,
    plannedEnd: r.planned_end_at,
    status: r.status,
    createdAt: r.created_at,
    checkedOutAt: r.checked_out_at,
    returnedAt: r.returned_at,
    cancelledAt: r.cancelled_at,
    overdue: r.status === 'checked_out' && new Date(r.planned_end_at) < now,
    returnedLate: r.status === 'returned' && new Date(r.returned_at) > new Date(r.planned_end_at),
    returnedEarly: r.status === 'returned' && new Date(r.returned_at) < new Date(r.planned_end_at),
    // US-08: bookings on an asset that was later marked unavailable are flagged, never deleted.
    assetUnavailable: r.asset_status === 'unavailable' && r.status === 'confirmed',
    assetNotice: r.asset_status === 'unavailable' ? r.public_notice : null,
  };
  if (includeStudent) out.student = { id: r.account_id, name: r.student_name, email: r.student_email };
  return out;
}
