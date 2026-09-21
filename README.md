# Spitex Cura Mobile — Deployment

This repository contains the Spitex Cura Mobile dashboard (Node.js + Express + PostgreSQL).

## Quick Railway deployment

Prerequisites:
- A GitHub account and this repository pushed to GitHub
- A Railway account (https://railway.app) connected to GitHub

Steps:

1. Push repository to GitHub (if not already):

```powershell
cd "C:\Users\dorot\OneDrive\Dokumente\DorotheaWork"
git init        # only if not already
git add .
git commit -m "Prepare for Railway"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

2. Create a Railway project and connect the GitHub repo
- Log in to Railway and click **New Project → Deploy from GitHub**
- Select this repository and the `main` branch
- Railway will detect `package.json`. Default `npm start` will be used (we also provide `railway.json` and `Dockerfile`)

3. Add PostgreSQL to the Railway project
- In the Railway project, click **Plugins → Postgres → Provision**
- Railway provisions a Postgres instance and sets a `DATABASE_URL` for you

4. Set environment variables
- In Railway project settings (Variables) add:
  - `SESSION_SECRET` — generate a long random string (example below)
  - `NODE_ENV` = `production`
- `DATABASE_URL` will be present automatically after adding Postgres

Generate a `SESSION_SECRET` (PowerShell):
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Deploy and monitor logs
- Trigger a deploy in Railway (it runs `npm start`)
- Open the app URL provided by Railway and visit `/login`

6. Test accounts
- Use seeded users: `Anita 1` → password `anita1` (default password is name lowercased without spaces)
- Admin: `Dorothea El Ghobashy` → `admin123` (if left as seeded)

Troubleshooting
- If the app fails to connect to Postgres, check `DATABASE_URL` and Railway Postgres status.
- SSL: `db.js` enables SSL for remote DBs (rejectUnauthorized: false) — ok for hosted DBs.
- Missing `SESSION_SECRET` will prevent server from running correctly — set it in Railway variables.

Automate redeploys
- Commit and push updates to `main` — Railway will rebuild and redeploy automatically.

Local testing
- To run locally with a local Postgres, set `DATABASE_URL` in an `.env` file and run `node server.js`.

If you want, I can provide the explicit Railway UI click sequence or prepare a GitHub Actions workflow to deploy automatically.
