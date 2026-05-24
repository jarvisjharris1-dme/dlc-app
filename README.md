# Divine Life Connect — Attendance App

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Deploy to AWS Amplify

1. Push this folder to a GitHub repo
2. Go to AWS Amplify Console → "New app" → "Host web app"
3. Connect your GitHub repo
4. Amplify auto-detects the build settings from `amplify.yml`
5. Click "Save and deploy"

No environment variables needed for the base version.
When adding Supabase backend, add these env vars in Amplify:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Features
- Full attendance roster with 4-class tracking
- New member luncheon attendance checkbox
- Assignee dropdown (fully customizable via "Manage assignees")
- Filter by year, month, assignee, or name search
- Photo taken / application complete / luncheon attended checkboxes
- Teacher initials per member
- Status tracking (New / In progress / Complete)
- CSV import with column mapping and duplicate detection
- Shelby Next direct connect (ready for your API credentials)
- CSV export formatted for Shelby Next import
