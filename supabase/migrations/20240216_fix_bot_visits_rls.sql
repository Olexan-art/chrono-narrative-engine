-- 1. Enable RLS
ALTER TABLE "public"."bot_visits" ENABLE ROW LEVEL SECURITY;

-- 2. Grant Permissions
GRANT SELECT ON "public"."bot_visits" TO "authenticated";
GRANT ALL ON "public"."bot_visits" TO "service_role";
REVOKE ALL ON "public"."bot_visits" FROM "anon";

-- 3. Create Policies

-- Service Role Insert
DROP POLICY IF EXISTS "Service Role Insert Bot Visits" ON "public"."bot_visits";
CREATE POLICY "Service Role Insert Bot Visits"
ON "public"."bot_visits"
FOR INSERT
TO service_role
WITH CHECK (true);

-- Service Role Full Access
DROP POLICY IF EXISTS "Service Role Full Access Bot Visits" ON "public"."bot_visits";
CREATE POLICY "Service Role Full Access Bot Visits"
ON "public"."bot_visits"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admin Select
DROP POLICY IF EXISTS "Admin Select Bot Visits" ON "public"."bot_visits";
CREATE POLICY "Admin Select Bot Visits"
ON "public"."bot_visits"
FOR SELECT
TO authenticated
USING (true);
