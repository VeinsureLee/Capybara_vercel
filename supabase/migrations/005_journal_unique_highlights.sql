-- Migration 005: Journal unique constraint + visual_highlights column
-- Supports V2.1 improvements: blocking mechanism & image annotations
-- Safe to run multiple times (idempotent)

-- 1. Clean up duplicate journals (keep earliest created per travel+day)
DELETE FROM journals
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY travel_id, day_number
      ORDER BY created_at ASC
    ) as rn
    FROM journals
  ) t
  WHERE rn > 1
);

-- 2. Add UNIQUE constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journals_travel_day_unique'
  ) THEN
    ALTER TABLE journals
      ADD CONSTRAINT journals_travel_day_unique UNIQUE (travel_id, day_number);
  END IF;
END $$;

-- 3. Add visual_highlights JSONB column
ALTER TABLE journals
  ADD COLUMN IF NOT EXISTS visual_highlights JSONB DEFAULT NULL;
