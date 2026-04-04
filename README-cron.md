## Setting up WO auto-generation (pg_cron)

In Supabase Dashboard > Database > Extensions, enable pg_cron.

Then in the SQL editor run:

```sql
SELECT cron.schedule(
  'generate-work-orders-monthly',
  '0 9 15 * *',  -- 9am on the 15th of every month
  $$SELECT net.http_post(
    url := 'https://wlimdoqdyntslagvlqcd.supabase.co/functions/v1/generate-work-orders',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'
  )$$
);
```
