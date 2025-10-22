# Deployment Guide

This project contains a Django backend (`backend/`) and a Vite/React frontend (`frontend/`). Follow the steps below to run locally and deploy both services so the frontend can talk to the backend.

---

## 1. Local Development

### Backend
1. (Optional) create and activate a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```
2. Copy `.env.example` to `.env` and fill in local values (at minimum set `DJANGO_SECRET_KEY` and any third-party API keys you use).
3. Install dependencies and run migrations:
   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   ```
4. Start the dev server:
   ```bash
   python manage.py runserver
   ```

### Frontend
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Create `.env.local` with:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
   The Vite proxy forwards `/api` and `/quiz` requests to the Django server automatically.

---

## 2. Production Configuration

Before deploying, update your backend environment:

- Set `DJANGO_DEBUG=False`.
- Set `DJANGO_ALLOWED_HOSTS` to include the backend domain.
- Set `DJANGO_CSRF_TRUSTED_ORIGINS` and `DJANGO_CORS_ALLOWED_ORIGINS` to cover the HTTPS URLs of both backend and frontend.
- Provide Postgres connection details (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) if you use a managed database.
- Rotate and store all secrets (Cloudflare, MongoDB, Gemini, Weather API, etc.) in your hosting provider.

Run collectstatic locally once to verify static handling:
```bash
python manage.py collectstatic --noinput
```

---

## 3. Deploy the Backend (Render example)

1. Push the repo to GitHub/GitLab.
2. Create a Render account and add a **PostgreSQL** instance. Copy its connection details to use as environment variables.
3. Create a new **Web Service** pointing to the `backend` directory.
4. Configure the service:
   - **Environment**: `Python`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - **Start Command**: `gunicorn myproject.wsgi:application --bind 0.0.0.0:8000`
5. Add the environment variables from `.env.example` plus production secrets (generate a fresh `DJANGO_SECRET_KEY`).
6. Deploy and note the backend URL (currently `https://dressi-test2.onrender.com`).

---

## 4. Deploy the Frontend (Vercel example)

1. Ensure every network request uses `frontend/src/lib/api.ts` (already handled in this repo).
2. Connect the repo to Vercel and select the `frontend` directory as the root.
3. Build settings:
   - **Framework Preset**: `Other`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable `VITE_API_BASE_URL=https://dressi-test2.onrender.com`.
5. Deploy the site and verify it loads correctly.

---

## 5. Post-Deployment Checks

- Visit the backend URL and test key endpoints (`/api/login_mongo/`, `/quiz/recommend/`, etc.) to confirm they return 2xx responses.
- Visit the frontend domain and run through sign-up/login, recommendations, wardrobe, and weather badge flows. Use browser dev tools to ensure API calls hit the deployed backend.
- Monitor Render and Vercel logs for errors.

---

## 6. Ongoing Maintenance

- Keep dependencies up to date (`pip install --upgrade -r requirements.txt`, `npm update`).
- Rotate credentials periodically and update them in hosting dashboards.
- Add CI/CD checks to run tests, lint, or builds before deployment.
