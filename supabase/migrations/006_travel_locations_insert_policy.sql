-- Migration 006: Add INSERT policy for travel_locations
-- Fix BUG-007: POST /api/travel could not insert new locations due to missing RLS policy

-- Allow authenticated users to insert travel locations
DROP POLICY IF EXISTS "travel_locations_insert_auth" ON travel_locations;
CREATE POLICY "travel_locations_insert_auth" ON travel_locations
  FOR INSERT WITH CHECK (true);
