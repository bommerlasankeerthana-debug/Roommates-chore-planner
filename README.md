# Roommates Chore Planner

A beginner-friendly full-stack web application that helps roommates organize household chores, assign responsibility, set due dates, and track what has been completed.

## 1. Problem statement

In shared homes, chores can be forgotten or distributed unfairly. Roommates Chore Planner gives everyone one shared board so the team can see what needs to be done, who is responsible, and what is finished.

## 2. Objectives

- Create an account and log in securely.
- Create a household and invite roommates with an 8-character code.
- Join a household using an invite code.
- Add, assign, edit, complete, filter, and delete chores.
- Set optional due dates and see overdue tasks.
- Store application data persistently in Supabase PostgreSQL.

## 3. Users and features

There are two household membership labels: `owner` (the person who created the household) and `member` (someone who joined it). Both can manage chores in this MVP. Membership is checked by the backend before household data is returned or changed.

### Implemented features

- Register/login with hashed passwords and signed JWT tokens.
- Multiple households per account.
- Invite-code based joining.
- Household member list.
- Chore CRUD and assignment to a household member.
- Due dates, pending/completed status, overdue indicators, and status filter.
- Responsive HTML/CSS interface.
- Backend validation, rate limiting, security headers, and consistent JSON errors.

### Not included in this MVP

Recurring schedules, push notifications, password reset, email verification, chore points/rewards, and household deletion are not implemented. The app uses a simple server-issued JWT saved in browser localStorage for this student project; a production app should consider secure HttpOnly cookies or Supabase Auth and a more extensive security review.

## 4. Technology stack

- HTML5, CSS3, Vanilla JavaScript
- Node.js and Express
- Supabase PostgreSQL
- npm packages: `@supabase/supabase-js`, `bcryptjs`, `jsonwebtoken`, `dotenv`, `helmet`, `cors`, `express-rate-limit`
- Git and GitHub

## 5. Folder structure

```text
roommates-chore-planner/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   ├── .env.example
│   ├── .env                 # local only; ignored by Git
│   ├── .gitignore
│   ├── routes/
│   │   ├── auth.js
│   │   ├── households.js
│   │   └── chores.js
│   ├── middleware/
│   │   └── auth.js
│   └── utils/
│       └── validation.js
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 6. Prerequisites

Install these on Windows:

1. **Visual Studio Code:** https://code.visualstudio.com/
2. **Node.js LTS (includes npm):** https://nodejs.org/
3. **Git:** https://git-scm.com/downloads
4. A free Supabase account: https://supabase.com/

Open VS Code, choose **File → Open Folder**, and select `roommates-chore-planner`. Open **Terminal → New Terminal**.

Verify the tools:

```powershell
node --version
npm --version
git --version
```

Each command should print a version number. If Windows says a command is not recognized, install that tool and restart VS Code.

## 7. Set up Supabase

1. Sign in at https://supabase.com/ and create a new project.
2. Wait for the database to finish provisioning.
3. In the project dashboard, open **Project Settings → API** (the label may vary slightly).
4. Copy the Project URL and the server-side `service_role` key. Keep the key private.
5. Open **SQL Editor → New query**.
6. Open `database/schema.sql` in VS Code, copy all its SQL into the Supabase editor, and click **Run**.
7. Open **Table Editor** and confirm these tables exist: `profiles`, `households`, `household_members`, and `chores`.

This project uses a custom Express authentication layer, not Supabase Auth. The backend connects to PostgreSQL through Supabase's server-only service-role key. RLS is enabled, but service-role access bypasses RLS; therefore, backend JWT and household-membership checks are essential. Never put the service-role key in `frontend/app.js`, HTML, CSS, or GitHub.

## 8. Configure environment variables

In VS Code, open `backend/.env`. Replace the placeholder values:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVER_ONLY_KEY_HERE
JWT_SECRET=PASTE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
JWT_EXPIRES_IN=7d
```

Generate a strong JWT secret in a terminal:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the printed value into `JWT_SECRET`. Do not put quotes around the values unless quotes are part of the value.

- `.env` contains your real local secrets and is excluded from Git.
- `.env.example` documents the required variable names with safe placeholders and should be committed.
- Never share the service-role key or commit `.env`.

## 9. Install dependencies and run

In VS Code terminal, change into the backend directory:

```powershell
cd backend
npm install
npm run check
npm start
```

- `npm install` downloads the required packages.
- `npm run check` runs Node.js syntax checks on the backend files.
- `npm start` starts the server.

Expected terminal message:

```text
Roommates Chore Planner running at http://localhost:3000
```

Open http://localhost:3000 in your browser. The server serves the frontend and API from the same origin. Keep the terminal open while using the app.

Health check: visit http://localhost:3000/api/health. Expected JSON:

```json
{"status":"ok","service":"Roommates Chore Planner API"}
```

## 10. How to use the application

1. Create an account with your name, email, and a password of at least 8 characters.
2. Select **Create a household**, enter a name, and create it.
3. Copy the household's 8-character invite code and share it with roommates.
4. Each roommate creates their own account, then chooses **Join a household** and enters the code.
5. Select **Add chore**, enter the task, optional details, roommate, and due date, then save.
6. Use the check button to mark a chore completed or pending.
7. Use the edit icon to update a chore and the × icon to delete it.
8. Use the filter to display all chores, to-do chores, or completed chores.
9. Use the household selector to switch between households.

## 11. Architecture

```text
Browser (HTML/CSS/Vanilla JS)
          |
          | fetch() with JSON + Bearer JWT
          v
Node.js + Express REST API
          |
          | server-only Supabase client
          v
Supabase PostgreSQL
```

The browser never connects directly to PostgreSQL. Express validates requests, verifies the signed JWT, checks household membership, and then accesses the database.

## 12. REST API

All request and response bodies use JSON. Authenticated routes require:

`Authorization: Bearer YOUR_JWT_TOKEN`

### Authentication

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create an account | No |
| POST | `/api/auth/login` | Log in | No |
| GET | `/api/auth/me` | Get current account | Yes |

Register body: `{"name":"Alex","email":"alex@example.com","password":"example-pass-123"}`

Login body: `{"email":"alex@example.com","password":"example-pass-123"}`

Successful authentication returns `{ "token": "...", "user": {...} }`.

### Households

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/households` | List households for current user | Yes |
| POST | `/api/households` | Create household and become owner | Yes |
| POST | `/api/households/join` | Join with invite code | Yes |
| GET | `/api/households/:id/members` | List household members | Household member |

Create body: `{"name":"Sunshine Flat"}`. Join body: `{"invite_code":"A1B2C3D4"}`. Invite codes are generated by the backend; use the code displayed in your app.

### Chores

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/chores?household_id=UUID` | List chores; optional `status=pending` or `status=completed` | Household member |
| POST | `/api/chores` | Create a chore | Household member |
| PATCH | `/api/chores/:id` | Update title/details/assignee/due date/status | Household member |
| DELETE | `/api/chores/:id` | Delete a chore | Household member |

Example create body:

```json
{
  "household_id": "HOUSEHOLD_UUID",
  "title": "Clean the kitchen",
  "description": "Wipe the counters and sweep the floor",
  "assigned_to": "ROOMMATE_UUID",
  "due_date": "2026-12-01"
}
```

A chore's `status` must be `pending` or `completed`. Successful create returns HTTP 201; successful update returns HTTP 200. Invalid input returns HTTP 400, missing/invalid login returns HTTP 401, non-member access returns HTTP 403, missing records return HTTP 404, and duplicate email returns HTTP 409. Unexpected server errors return a generic HTTP 500 message; details are logged only in the server terminal.

## 13. Database tables

- `profiles`: account name, unique email, password hash.
- `households`: household name, invite code, creator.
- `household_members`: links profiles to households and stores membership role.
- `chores`: task details, household, optional assignee, due date, status, timestamps.

Foreign keys maintain relationships. Unique email and invite code constraints prevent duplicates. Chores are indexed by household/status, assignee, and due date.

## 14. Testing checklist

| Test | Steps | Expected result |
|---|---|---|
| Health check | Open `/api/health` | JSON status `ok` |
| Registration | Register a new email | Account created and dashboard appears |
| Duplicate email | Register same email again | Helpful duplicate-account error |
| Login | Enter correct credentials | Dashboard appears |
| Wrong password | Enter incorrect password | Login error; no token issued |
| Create household | Submit a household name | Household and invite code appear |
| Join household | Use another account and the code | Roommate appears in member list |
| Invalid invite | Enter an unknown code | Error message appears |
| Add chore | Create task with a title | Task appears on board |
| Assign chore | Choose a roommate | Correct assignee appears |
| Invalid title | Try a one-character title | Validation message appears |
| Complete task | Click its check button | Task shows completed and stats update |
| Filter tasks | Select To do / Completed | Only matching tasks are shown |
| Edit task | Change details and save | Updated details appear |
| Delete task | Click × and confirm | Task is removed |
| Household privacy | Log in to an account not in a household and request its chores | API returns 403 |
| Responsive layout | Resize browser to phone width | Layout adapts without horizontal overflow |

Run `npm run check` from `backend/` after editing backend JavaScript. This checks syntax only; it does not prove that remote Supabase credentials or browser flows work. Complete the manual tests after configuring your own Supabase project.

## 15. Troubleshooting

- **`Cannot reach the server`:** make sure `npm start` is still running and visit `http://localhost:3000`.
- **Supabase URL/key error:** check `backend/.env`, remove placeholder values, save the file, and restart the server.
- **Relation/table does not exist:** run all of `database/schema.sql` in Supabase SQL Editor and verify the table names.
- **JWT secret warning:** set a random secret at least 32 characters long in `JWT_SECRET`, then restart.
- **Port already in use:** change `PORT=3000` to `PORT=3001` in `backend/.env` and open `http://localhost:3001`.
- **Invite code rejected:** use the exact eight-character code shown for the household.
- **`npm` not recognized:** install Node.js LTS and restart VS Code/terminal.
- **Browser shows an old version:** hard-refresh with Ctrl+F5.

## 16. Git and GitHub

1. Create a new repository at https://github.com/new. Do not add a README there if you already have this local README.
2. Open the terminal at the project root (one level above `frontend`, `backend`, and `database`).
3. Verify `.env` is ignored before staging:

```powershell
git init
git status
git check-ignore backend/.env
git add .
git status
git commit -m "Build Roommates Chore Planner"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the repository URL copied from GitHub. `git check-ignore backend/.env` should print `backend/.env`. Review the staged files from `git status`; do not commit credentials, `node_modules/`, personal data, or database exports. If a secret was committed, changing `.gitignore` is not enough: rotate the credential immediately and remove it from repository history as appropriate.

## 17. Security notes and future improvements

- Keep the Supabase service-role key only in the backend environment.
- Passwords are hashed with bcrypt; they are not stored as plain text.
- API requests use signed JWTs and check household membership.
- RLS is enabled, but the service-role key bypasses it; the backend authorization checks must remain in place.
- For production, prefer a thoroughly reviewed auth flow, secure HttpOnly cookies or Supabase Auth, stricter CORS origins, stronger monitoring, email verification, password reset, and automated integration tests.
- Possible improvements: rotating chore schedules, reminders, weekly reports, chore points, profile settings, and household owner-only management.

## 18. Final checklist

- [ ] Supabase tables created from `database/schema.sql`
- [ ] `backend/.env` has your real Supabase URL/key and a random JWT secret
- [ ] `npm install` completed inside `backend/`
- [ ] `npm run check` passes
- [ ] `npm start` launches the app
- [ ] `/api/health` returns `ok`
- [ ] Register, create/join household, and chore workflows tested
- [ ] `backend/.env` is not staged or uploaded to GitHub
