
-- Force PostgREST schema cache reload by notifying the replication channel
NOTIFY pgrst, 'reload schema';
