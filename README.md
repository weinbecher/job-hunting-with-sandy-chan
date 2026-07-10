# Career with Sandy

A personal web app for tracking job applications, job links, CV versions, contacts, follow-ups, and outcomes.

## What It Does

- Tracks every job opportunity with role, company, link, source, salary, location, notes, and status.
- Keeps a CV vault so each application can point to the exact local CV file/version you sent.
- Stores recruiter, referral, hiring manager, and alumni contacts.
- Shows a Kanban board for the pipeline: saved, preparing, applied, interviewing, and closed.
- Highlights follow-ups when a next action is due or an application is older than seven days.
- Exports applications to CSV and imports CSV rows back into the tracker.
- Stores data locally in your browser with `localStorage`.

## Run Locally

Open `index.html` in a browser.

For a local web server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Suggested Personal Workflow

1. Add jobs when you find them.
2. Add or update a CV version before applying.
3. Link the CV version to the application.
4. Set a next action and date every time you touch an application.
5. Review reminders daily.
6. Export CSV weekly as a backup.

## Future Ideas

- Store real uploaded CV files in a private folder.
- Add job description keyword extraction.
- Add CV-to-job matching score.
- Add calendar export for interviews and follow-ups.
- Add a small backend with SQLite when localStorage is no longer enough.
