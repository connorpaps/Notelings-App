# Notelings Deployment Checklist — Superseded Reference

> Use [`DEMO_DEPLOYMENT_REMAINING_STEPS.md`](DEMO_DEPLOYMENT_REMAINING_STEPS.md) instead. The final architecture is one Vercel project with private root mode and isolated `/demo` mode; the instructions below describe the earlier demo-only setup.

This file is retained only as historical reference.

## What we are building

We are making two safe copies of Notelings:

- **Private app:** your real notes.
- **Demo app:** fake example notes that you can show on your portfolio.

The demo must never be connected to your real private notes.

---

## What you have already done

You already created the demo Supabase project.

Your demo project details are:

```text
Project URL: https://aczmwzeupytsfdcwmofz.supabase.co
Project ID:  aczmwzeupytsfdcwmofz
```

Do not create another demo Supabase project.

---

## What you need to do now

### Step 1 — Save the two demo keys safely

In your demo Supabase project:

1. Click **Project Settings**.
2. Click **API**.
3. Find **Publishable keys**.
4. Copy the `sb_publishable_...` key.
5. Find **Secret keys**.
6. Copy the `sb_secret_...` key.
7. Save both keys in a password manager or private local note.

Do **not**:

- Send the keys to me.
- Put them in GitHub.
- Put them in a screenshot.
- Use the secret key in browser/client code.

You do not need to do anything else in Supabase right now.

### Step 1B — Create a safe local demo settings file

This lets Buffy set up the **demo** database without accidentally touching your private database.

In the main Notelings project folder, create a new file named:

```text
.env.demo.local
```

Paste this into the file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://aczmwzeupytsfdcwmofz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_demo_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_demo_secret_key
SUPABASE_ACCESS_TOKEN=your_temporary_sbp_token

NOTELINGS_OWNER_EMAIL=demo-owner@notelings.local
NOTELINGS_DEMO_EMAIL=demo@notelings.local
NOTELINGS_DEMO_PROJECT_REF=aczmwzeupytsfdcwmofz
```

Replace only these three placeholders with the private values you saved:

- `your_demo_publishable_key` — the demo `sb_publishable_...` key
- `your_demo_secret_key` — the demo `sb_secret_...` key
- `your_temporary_sbp_token` — the temporary Supabase token beginning with `sbp_`

Do **not**:

- Send this file or its contents in chat.
- Put this file in GitHub.
- Add `SUPABASE_ACCESS_TOKEN` to Vercel.
- Use your private Supabase keys in this file.

The file is already covered by the repository’s secret-file ignore rules. After setup, Buffy will remove the temporary token from the file.

When it is saved, tell Buffy only:

```text
demo env ready
```

---

### Step 2 — Do not create the demo account yourself

You do **not** need to create the `demo` user manually.

That account is just a pretend visitor account. When someone clicks **Enter demo workspace**, the app will use it to show fake demo notes.

I will create:

```text
Username: demo
Demo password: generated separately
Demo notes: fictional examples
```

Never copy your real notes into the demo project.

---

### Step 3 — Create the Vercel website project

1. Go to <https://vercel.com/new>.
2. Sign in with the account connected to your GitHub repository.
3. Choose the Notelings repository.
4. Click **Deploy** using the default settings.
5. If Vercel asks for a Node version, choose **22**.

Do not worry if the first deployment is not ready yet. I still need to add the private/demo routing code and final environment settings.

Send me the Vercel project URL when it exists. The URL is safe to share.

---

### Step 4 — Choose website addresses

If you own a domain, the cleanest setup is:

```text
app.yourdomain.com  = private app
demo.yourdomain.com = portfolio demo
```

If you do not own a domain yet, that is fine. Use the temporary Vercel URL for now and tell me.

You do not need to configure Supabase redirect URLs yet. I will do that after the routing code is ready.

---

### Step 5 — Add the separate Gemini key for demo AI

Because you chose live demo AI, create a separate Gemini key:

1. Open <https://aistudio.google.com/apikey>.
2. Click **Create API key**.
3. Choose **Create a new Google Cloud project**.
4. Name it `notelings-portfolio-demo-ai`.
5. Copy the key privately.
6. In Vercel, open the demo project → **Settings → Environment Variables**.
7. Add this variable:

```text
GOOGLE_GENERATIVE_AI_API_KEY
```

8. Paste the Gemini key as its value.
9. Select **Production and Preview**.
10. Save it, but do not send the key to Buffy.

Keep billing disabled if you want to avoid charges. The app will also use a small application-level limit. If Google says billing is required, stop and tell Buffy instead of enabling it.

If Google says billing is required, stop and tell Buffy instead of enabling it. We can use the demo without live AI if needed; the app will keep its manual/no-AI capture path available.

---

## When you are finished

Send me only this:

```text
Ready
Demo Supabase URL: https://aczmwzeupytsfdcwmofz.supabase.co
Demo Supabase ID: aczmwzeupytsfdcwmofz
Vercel URL: paste-the-vercel-url-here
Custom domain: yes or no
Live demo AI: yes or no
```

Do **not** send:

- Publishable keys.
- Secret keys.
- Gemini keys.
- Passwords.
- Supabase access tokens.
- Your `.env.local` file.

---

## What Buffy will do after you say “Ready”

I will:

1. Make the app understand private mode versus demo mode.
2. Connect private mode only to your private Supabase project.
3. Connect demo mode only to the demo Supabase project.
4. Create the fake demo account.
5. Add fictional demo notes.
6. Add the demo reset button/process.
7. Add safe AI limits and fallback behavior.
8. Configure the final environment-variable names.
9. Configure Supabase login redirects.
10. Test that demo users cannot see private notes.
11. Test the Vercel preview.
12. Compare the preview visually before production launch.

---

## Do not do these things

- Do not create the demo account manually.
- Do not copy private notes into the demo project.
- Do not deploy the demo using the private Supabase URL.
- Do not paste keys or passwords into chat.
- Do not enable unlimited public Gemini usage.
- Do not delete the private Supabase project.
- Do not change database settings beyond the steps above.

## Simple order

```text
Demo Supabase project       ✅ already done
Save demo keys privately   ← you do this now
Create Vercel project      ← you do this next
Choose domain              ← optional
Tell Buffy “Ready”         ← then I take over
Private/demo routing       ← Buffy does this
Demo account + fake notes  ← Buffy does this
Preview testing            ← Buffy does this
Launch                    ← only after review
```
