# CSE 340 Service Network

The CSE 340 Service Network is a dynamic web application developed for BYU-Idaho's CSE 340 Web Backend Development course. It connects service organizations, volunteer projects, and service categories.

- Course: BYU-Idaho CSE 340 Web Backend Development
- GitHub: [Prosper-Anosike/cse340-course-repo](https://github.com/Prosper-Anosike/cse340-course-repo)
- Live website: [https://cse340-prosper.onrender.com/](https://cse340-prosper.onrender.com/)

The Week 01 site is live. As of 2026-11-03, live checks of the Week 02 pages confirmed 3 organizations, 15 projects, and 4 categories. The Render dashboard's deployed commit identity was not accessible, so compare it with the intended GitHub commit in Render's deployment events.

## Technology Stack

- Node.js and Express.js
- EJS templates and reusable partials
- PostgreSQL with node-postgres (`pg`)
- HTML5 and CSS3
- Git and GitHub
- Render

## Week 01 Features

- Express server and routes for Home, Organizations, Service Projects, and Categories.
- Reusable EJS header and footer partials with dynamic page titles.
- Responsive styling and official course images.
- GitHub version control and Render hosting.

## Week 02 — Database Retrieval

- PostgreSQL connection pooling with environment-based configuration.
- Database models for organizations, projects, and categories.
- Dynamic organization names, descriptions, contact details, and logos.
- Dynamic service projects with their dates, locations, and sponsoring organizations.
- Dynamic service categories.
- SQL joins and database-driven EJS rendering.
- Credential-safe error handling and automated application tests.

Organizations, projects, and categories are retrieved from PostgreSQL rather than hardcoded in the page templates.

## Database Structure

The database contains four tables:

- `organization`
- `project`
- `category`
- `project_category`

One organization can sponsor many projects; each project belongs to one organization. Projects and categories have a many-to-many relationship implemented by `project_category`.

The sample dataset contains 3 organizations, 15 service projects, 4 categories, and 25 project-category associations. The schema and seed data are in [`src/setup.sql`](src/setup.sql).

## Database Models

- [`src/models/db.js`](src/models/db.js): PostgreSQL pool, TLS configuration, and `testConnection()`.
- [`src/models/organizations.js`](src/models/organizations.js): `getAllOrganizations()` retrieves organization records.
- [`src/models/projects.js`](src/models/projects.js): `getAllProjects()` retrieves projects joined with sponsoring organization names.
- [`src/models/categories.js`](src/models/categories.js): `getAllCategories()` retrieves category records.

## Local Setup

Install dependencies and start the development server:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. For production-style startup, run:

```powershell
npm start
```

The server uses the `PORT` environment variable when provided and otherwise listens on port `3000`.

## Environment Configuration

Create a local `.env` file. Replace the placeholder URL with the appropriate connection URL; never commit credentials. `.env` and `.env.*` are excluded from Git.

### Local Development

Use the PostgreSQL **External Database URL** and keep the internal self-signed TLS option unset or `false`:

```dotenv
DB_URL=YOUR_EXTERNAL_POSTGRES_URL
NODE_ENV=development
ENABLE_SQL_LOGGING=false
```

`ENABLE_SQL_LOGGING` is optional. When enabled, it logs SQL statements, not connection credentials or parameter values.

### Render Production

Set these variables in the Render service environment, using the PostgreSQL **Internal Database URL** for a database in the same Render region:

```dotenv
DB_URL=YOUR_INTERNAL_RENDER_POSTGRES_URL
NODE_ENV=production
DB_SSL_ALLOW_SELF_SIGNED_INTERNAL=true
ENABLE_SQL_LOGGING=false
```

The self-signed TLS option is accepted only in production with a recognized Render internal PostgreSQL hostname. External connections retain strict certificate verification. Render supplies `PORT` to the web service.

## Database Setup

`src/setup.sql` creates the tables and inserts the initial sample data. To initialize a newly created, empty course database, connect to it in pgAdmin, open its Query Tool, load `src/setup.sql`, and execute the script. The script uses conflict handling and contains no `DROP` statements, but review its effects before running it against any database that already contains data. Do not rerun it against production without first assessing the changes it would make.

Render Free PostgreSQL databases have a limited lifetime. Keep the setup script available so the schema and sample data can be recreated when needed.

## Testing

Run the automated suite with:

```powershell
npm test
```

The tests cover routes, database-backed rendering with mocked query results, SQL schema expectations, TLS configuration, and safe database error handling. The latest local result was **16 tests passed, 0 failed**. Separately, the application was tested locally against PostgreSQL; the automated mock suite does not itself verify the latest Render deployment.

## Render Deployment

Current service configuration:

- Runtime: Node
- Branch: `main`
- Root directory: empty
- Build command: `npm install`
- Start command: `npm start`
- Instance type: Free
- `NODE_ENV`: `production`
- Auto Deploy: On Commit

The live website is [https://cse340-prosper.onrender.com/](https://cse340-prosper.onrender.com/). After each deployment, verify that Render shows the intended commit as live and that the service displays its database-backed organizations, all 15 projects, and four categories.
