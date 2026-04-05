## Cron schedule (Supabase Dashboard > Database > Extensions > pg_cron)

Run once per year on Jan 1 to extend open-ended agreements:

```sql
SELECT cron.schedule(
  'extend-open-ended-agreements',
  '0 9 1 1 *',  -- 9am on Jan 1
  $$SELECT net.http_post(
    url := 'https://wlimdoqdyntslagvlqcd.supabase.co/functions/v1/generate-work-orders',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'
  )$$
);
```
