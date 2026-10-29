-- Extend booking status to cover full 14-state machine
-- Safe: only adds new valid values, never removes existing ones
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
-- Status is TEXT, so no enum alteration needed — just document the valid values:
COMMENT ON COLUMN bookings.status IS
  'Valid states: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | WAITLISTED |
   AWAITING_SIGNATURES | AWAITING_PAYMENT | CONFIRMED | CHECKED_IN |
   RETURN_SUBMITTED | DAMAGE_REVIEW | COMPLETED | DISPUTE_OPEN |
   RESOLVED_OWNER | RESOLVED_USER | RESOLVED_SPLIT | CANCELLED';

-- Add waitlist_promote_deadline column (30-min TTL after promotion)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS waitlist_promote_deadline TIMESTAMPTZ;

-- Add payment_reference column (Razorpay payment ID)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference TEXT;
