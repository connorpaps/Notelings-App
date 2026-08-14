# Notelings Unified Deployment — Remaining Steps

This is the only checklist to use now.

## Final architecture

```text
One Vercel project
├── /       → private Supabase project
└── /demo   → isolated demo Supabase project
```

The current `notelings-portfolio-demo.vercel.app` deployment remains a rollback copy until the unified version is verified.

## Already completed

- Private Supabase project exists and is protected by Auth/RLS.
- Demo Supabase project exists:

  ```text
  https://aczmwzeupytsfdcwmofz.supabase.co
  ```

- Demo database has fictional seed data and a shared demo account.
- Demo AI limits are implemented: 12 categorization calls/day and 6 chat calls/day.
- One Vercel project exists.
- Separate Gemini key was created.
- Unified `/demo` routing code is implemented and locally tested; it is awaiting the push and Vercel environment migration.

## What you need to do in Vercel

After the unified code is deployed, the one Vercel project needs both sets of Supabase values.

### Private project values

Use the values from your existing private `.env.local`:

```text
PRIVATE_SUPABASE_URL
PRIVATE_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_PRIVATE_SUPABASE_URL
NEXT_PUBLIC_PRIVATE_SUPABASE_ANON_KEY
```

### Demo project values

Use the demo project values you saved:

```text
DEMO_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
DEMO_SUPABASE_ANON_KEY
DEMO_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_DEMO_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
NEXT_PUBLIC_DEMO_SUPABASE_ANON_KEY
```

### Shared demo settings

```text
NOTELINGS_DEMO_EMAIL=demo@notelings.local
NOTELINGS_DEMO_PASSWORD=copy from your local demo settings file
GOOGLE_GENERATIVE_AI_API_KEY=your separate demo Gemini key
NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY=auto
```

Set these for **Production and Preview**.

Important:

- Service-role keys stay server-side.
- Never add `SUPABASE_ACCESS_TOKEN` to Vercel.
- Never add `NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS` to Vercel.
- Never send keys or passwords in chat.

## What Buffy handles

Buffy has handled the local implementation and validation. The remaining live work is the Vercel environment migration and deployed smoke test.

Buffy will:

1. Finish and test trusted `/demo` routing.
2. Ensure root requests use only private Supabase.
3. Ensure `/demo` requests use only demo Supabase.
4. Keep private and demo Auth cookies separate.
5. Test forged mode/header attempts.
6. Test private and demo capture, chat, Realtime, graph, and archive behavior.
7. Run the full local test/build/E2E suite.
8. Push the unified code.
9. Test the deployed Vercel version.
10. Compare root and `/demo` visuals.

## What you do after Buffy says the unified code is ready

1. Add the private and demo variables above to the one Vercel project.
2. Redeploy the latest commit if Vercel does not deploy it automatically.
3. Open:

   ```text
   https://your-vercel-url.vercel.app/
   ```

   This must be the private app.

4. Open:

   ```text
   https://your-vercel-url.vercel.app/demo
   ```

   This must be the demo app.

5. Tell Buffy only:

   ```text
   unified deployment ready
   ```

## Do not do these things

- Do not create another Vercel project.
- Do not create another Supabase project.
- Do not rename the current demo URL before unified routing is verified.
- Do not run SQL manually.
- Do not create the demo account manually.
- Do not copy private notes into the demo project.
- Do not put service-role keys in browser-visible variables.
- Do not put the temporary Supabase token in Vercel.
- Do not delete the current demo deployment until rollback testing passes.
