# parse-job — Autofill setup

This Supabase Edge Function powers the **✨ Autofill** button in the New application
dialog. It reads a job advert and fills in the role, company, location, salary, source,
description and tags for you.

It runs on the server (not in the browser) for two reasons:

1. The Anthropic API key is a **billing credential**. Anything in the website's files is
   public — the key has to stay server-side.
2. Browsers aren't allowed to fetch other websites' pages directly, so the fetch has to
   happen server-side anyway.

## What it costs

It uses **Claude Haiku 4.5**, which works out at roughly **1p per job** you autofill.
There is no subscription — you add credit and it draws down as you use it. Reading 200
jobs costs around £2.

## Setup (once)

### 1. Get an Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Add a small amount of credit (£5 goes a long way at 1p per job).
3. **API keys → Create key**, and copy it. It starts with `sk-ant-`.

> Keep this key private — unlike the Supabase anon key, it is **not** safe to share or
> commit. It only ever goes into the Supabase secret below.

### 2. Store the key in Supabase

In your Supabase project: **Edge Functions → Secrets → Add new secret**

| Name | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | the `sk-ant-...` key you just created |

### 3. Deploy the function

**Easiest — from the dashboard (nothing to install):**

1. Supabase → **Edge Functions → Deploy a new function → Via editor**
2. Name it exactly `parse-job`
3. Paste the entire contents of `index.ts` from this folder
4. **Deploy**

<details>
<summary>Alternative: using the Supabase CLI</summary>

```bash
supabase functions deploy parse-job
```

Run it from the repository root, with the CLI installed and linked to your project.
</details>

## Using it

1. Open **+ New application** and paste the job link.
2. Press **✨ Autofill**. The fields populate — nothing is saved yet.
3. Check it over and press **Save**.

### When a site blocks it

LinkedIn and Indeed deliberately block automated page reading. When that happens the app
says so and shows a **paste box** — copy the job description text from the page, paste it
in, and press **Read pasted text**. Same result, one extra copy-paste.

Sites that generally work directly: Greenhouse, Lever, Workable, SmartRecruiters, and most
company careers pages.

## Notes

- Autofill **overwrites** the fields it extracts. It never touches your own notes, status,
  dates, CV selection or contact.
- Only signed-in users can call it, so nobody else can spend your API credit.
- Job pages are treated purely as data: the function constrains the AI to return only the
  seven fields above, and you always review them before saving.
