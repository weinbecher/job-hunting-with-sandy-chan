# Career with Sandy

A personal web app for tracking job applications, job links, CV versions, contacts,
follow-ups, and outcomes. Data is stored in a free [Supabase](https://supabase.com)
project and the site is hosted for free on GitHub Pages.

## What It Does

- Tracks every job opportunity with role, company, link, source, salary, location, notes, and status.
- Keeps a CV vault so each application can point to the exact CV file/version you sent.
- Stores recruiter, referral, hiring manager, and alumni contacts.
- Shows a Kanban board for the pipeline: saved, preparing, applied, interviewing, and closed.
- Highlights follow-ups when a next action is due or an application is older than seven days.
- Exports applications to CSV and imports CSV rows back into the tracker.
- **Stores data in Supabase**, private to your signed-in account, so it syncs across devices.
- **Uploads CV files to Supabase Storage** (private) so the actual documents travel with the records.

## How it's built

Plain HTML/CSS/JavaScript — no build step. The Supabase JavaScript client loads from a CDN.

- `index.html` / `styles.css` — the UI.
- `app.js` — all the app logic and rendering (an ES module).
- `data.js` — the Supabase data layer (auth, database CRUD, file storage).
- `config.js` — your Supabase project URL and public anon key.
- `seed-data.js` — the "Sophia pipeline" starter data used by the Import button.
- `supabase/schema.sql` — the database tables, security rules, and storage bucket.

## First-time setup

You only do this once.

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (the free tier is fine).
2. In the project, go to **Project Settings → API** and copy:
   - **Project URL**
   - the **anon** **public** key
3. Open `config.js` and paste those two values in. These are safe to commit and make
   public — the app is protected by login and per-user security rules, not by hiding the
   key. **Never** put the `service_role` key or database password in this file.

### 2. Create the database tables

1. In Supabase, open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.

This creates the `applications`, `cvs`, and `contacts` tables, the row-level-security
rules that keep each account's data private, and the private `cv-files` storage bucket.

### 3. Configure login (email magic link)

1. In Supabase, go to **Authentication → Sign In / Providers** and make sure **Email** is enabled.
2. Go to **Authentication → URL Configuration** and add your site URLs to
   **Site URL** / **Redirect URLs**:
   - `http://localhost:8080` (for local testing)
   - your GitHub Pages URL, e.g. `https://weinbecher.github.io/job-hunting-with-sandy-chan/`

### 4. Host it on GitHub Pages

1. Commit and push your changes (including the filled-in `config.js`).
2. On GitHub, go to the repo **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the `main`
   branch and the `/ (root)` folder, and **Save**.
4. After a minute the site is live at your Pages URL.

## Using it

1. Open the site (locally or the Pages URL) and sign in: enter your email, click the link
   Supabase sends you.
2. First time only, load your data:
   - **Import Sophia pipeline** — loads the starter jobs from `seed-data.js`, or
   - **Import from this browser** — copies any data you had saved in this browser before the
     Supabase move (job/CV/contact records migrate; CV **files** must be re-uploaded).
3. Add jobs, CV versions, and contacts. Everything saves to Supabase automatically.

### Run locally

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. (Serve over http — opening `index.html` directly as a
`file://` won't work because the app is an ES module.)

## A note on security

The `config.js` values (project URL + anon key) are meant to be public. Real protection
comes from two things set up by `supabase/schema.sql`:

- **Login is required** — every table read/write needs a signed-in user.
- **Row-Level Security** — each account can only ever see and change its own rows, and can
  only touch its own CV files in storage.

Each signed-in account has its own private data; two people signing in see separate trackers.

## Future ideas

- Live multi-device sync with Supabase Realtime.
- A shared workspace so two accounts can collaborate on the same job list.
- Job description keyword extraction and CV-to-job matching score.
- Calendar export for interviews and follow-ups.
