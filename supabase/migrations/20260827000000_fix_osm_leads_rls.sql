-- Remove overly permissive RLS policy on osm_leads
-- SECURITY: The "Allow anon full access to leads" policy granted full CRUD access
-- to anonymous (unauthenticated) users, completely bypassing all other RLS policies.
-- This migration drops that policy so only authenticated users can access leads.

DROP POLICY IF EXISTS "Allow anon full access to leads" ON public.osm_leads;
