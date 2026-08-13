# Notelings Demo Deployment — Everything Remaining

This is the single checklist to use from now on.

## The goal

Create a public portfolio demo that:

- Uses fictional demo data only.
- Cannot see your private workspace.
- Allows temporary visitor notes.
- Can use Gemini with a small safety limit.
- Can be reset to clean sample data.

---

## Already completed

You do **not** need to repeat these steps:

- Demo Supabase project created.
- Demo Supabase project URL:

  ```text
  https://aczmwzeupytsfdcwmofz.supabase.co
  ```

- Demo Supabase project ID:

  ```text
  aczmwzeupytsfdcwmofz
  ```

- Demo Supabase publishable key obtained.
- Demo Supabase secret key obtained.
- Demo Vercel project created.
- Demo Vercel URL:

  ```text
  https://notelings-portfolio-demo.vercel.app
  ```

- No custom domain is needed right now.
- Separate demo/private project setup chosen.
- Separate Gemini key created for the demo.

---

# The only things you need to do now

## 1. Create one local demo settings file

In the main Notelings project folder, create a file named exactly:

```text
.env.demo.local
```

Paste this into it:

```env
NEXT_PUBLIC_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_demo_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_demo_secret_key
SUPABASE_ACCESS_TOKEN=your_temporary_supabase_token

NOTELINGS_OWNER_EMAIL=demo-owner@notelings.local
NOTELINGS_DEMO_EMAIL=demo@notelings.local
NOTELINGS_DEMO_PROJECT_REF=aczmwzeupytsfdcwmofz
```

Replace only these three placeholders:

- `your_demo_publishable_key` = your demo `sb_publishable_...` key.
- `your_demo_secret_key` = your demo `sb_secret_...` key.
- `your_temporary_supabase_token` = your temporary token beginning with `sbp_`.

Do not send the file or its contents to Buffy.

Do not put `SUPABASE_ACCESS_TOKEN` in Vercel.

---

## 2. Put the Gemini key in Vercel

Only do this if you have not already done it.

1. Open the Vercel project.
2. Go to **Settings**.
3. Go to **Environment Variables**.
4. Add this variable name:

   ```text
   GOOGLE_GENERATIVE_AI_API_KEY
   ```

5. Paste your separate demo Gemini key as the value.
6. Select **Production and Preview**.
7. Save it.

Do not send the Gemini key to Buffy.

Do not enable billing just to continue. If Google requires billing, stop and tell Buffy.

---

## 3. Tell Buffy only this

After the local file is saved, send:

```text
demo env ready
```

Do not send keys, passwords, tokens, screenshots of keys, or the `.env.demo.local` file.

---

# What Buffy will do after that

Buffy will:

1. Verify the local file without printing any secrets.
2. Apply the demo database setup to the demo project only.
3. Create the demo login account.
4. Add fictional sample notes.
5. Add the clean demo reset/seed behavior.
6. Add the small Gemini usage limit and fallback behavior: 12 categorization calls/day and 6 chat calls/day for the shared demo.
7. Tell you to remove the temporary Supabase token locally after verification.
8. Verify the demo cannot see private data.
9. Configure and test the Supabase login redirect.
10. Run the production health, security, WebGL, auth, capture, AI, and mobile checks.
11. Tell you exactly what values still need to be added to Vercel.
12. Compare the deployed visuals against the current local app.

---

# One later action you may need to take

After Buffy creates the demo account, Buffy will tell you to remove the temporary `SUPABASE_ACCESS_TOKEN` line from `.env.demo.local` and add these two values to Vercel:

```text
NOTELINGS_DEMO_EMAIL
NOTELINGS_DEMO_PASSWORD
```

The email will normally be:

```text
demo@notelings.local
```

The password will be generated for the demo. Do not send the password in chat. Paste it directly into Vercel when instructed.

Then you will click **Redeploy** in Vercel.

You do not need to create the demo account yourself.

---

# You do not need to do these things

- Do not run SQL manually.
- Do not create the demo user manually.
- Do not copy private notes into the demo project.
- Do not change the private Supabase project.
- Do not add the temporary Supabase token to Vercel.
- Do not send any secret keys or passwords in chat.
- Do not buy a custom domain yet.
- Do not create another Vercel or Supabase project.
- Do not enable unlimited Gemini usage.
- Do not change application code yourself.

---

# Final launch order

```text
Create .env.demo.local              ← you
Add Gemini key to Vercel             ← you, if not already done
Send “demo env ready”                ← you
Database/account/seed setup          ← Buffy
Small AI limit + fallback            ← Buffy
Add demo password to Vercel          ← you, when instructed
Redeploy                             ← you, when instructed
Production/security/visual testing   ← Buffy
Portfolio demo launch                ← after testing passes
```

Once step 1 is complete, there should be no additional setup checklist. Any remaining work after that is either handled by Buffy or will be presented as one clearly labeled Vercel action.