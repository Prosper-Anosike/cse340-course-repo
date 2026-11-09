# CSE 340 Service Network

The CSE 340 Service Network is a web application I developed as part of BYU-Idaho's CSE 340 Web Backend Development course. The project focuses on connecting service organizations with volunteers by providing information about community projects and different areas of service.

I started by building the website using Node.js, Express, and EJS. In Week 02, I expanded the application by integrating PostgreSQL, allowing organization details, service projects, and categories to be retrieved directly from a database instead of being hardcoded into the pages.

The project will continue to develop as I learn and implement more backend development concepts throughout the course.

**Course:** BYU-Idaho — CSE 340 Web Backend Development
**GitHub Repository:** [CSE 340 Course Repository](https://github.com/Prosper-Anosike/cse340-course-repo)
**Live Website:** [CSE 340 Service Network](https://cse340-prosper.onrender.com/)

## Technologies Used

The application is built using the following technologies:

* **Node.js:** Runs JavaScript on the server.
* **Express.js:** Handles server routing, middleware, and HTTP requests.
* **EJS:** Generates dynamic HTML pages using reusable templates and partials.
* **PostgreSQL:** Stores information about organizations, projects, and service categories.
* **node-postgres (`pg`):** Manages database connections and executes SQL queries.
* **HTML5 and CSS3:** Provide the website's structure, styling, and responsive layout.
* **Git and GitHub:** Manage source code and version history.
* **Render:** Hosts the web application and PostgreSQL database.

## Week 01 — Initial Site Creation

In Week 01, I focused on setting up the application and building the foundation for the remaining coursework.

I created an Express server and developed four main pages: Home, Organizations, Service Projects, and Categories. I also used EJS templates to make the pages easier to organize and maintain.

### Features Implemented

* Set up a Node.js application with Express.
* Created routes for all four pages.
* Used EJS templates and reusable header and footer partials.
* Implemented dynamic page titles.
* Added navigation between the main pages.
* Organized CSS and image files within the `public` directory.
* Designed a responsive layout for desktop and mobile devices.
* Added the official course images and organization logos.
* Connected the GitHub repository to Render for deployment.

By the end of Week 01, the website was running locally and had been successfully deployed to Render.

## Week 02 — Database Retrieval

In Week 02, I focused on connecting the application to PostgreSQL and displaying information retrieved from the database.

Previously, the website displayed organization and project information directly from the EJS templates. With the database integration, the application now retrieves those records through SQL queries and passes the results to the appropriate pages.

This makes the website easier to maintain and allows the information to change without manually editing the page templates.

### Features Implemented

* Created and configured a PostgreSQL database on Render.
* Connected the database to the Node.js application using `pg`.
* Implemented database connection pooling.
* Used environment variables to manage database configuration securely.
* Created database models for organizations, projects, and categories.
* Retrieved organization names, descriptions, contact emails, and logos.
* Retrieved service projects with their descriptions, dates, locations, and sponsoring organizations.
* Retrieved service categories dynamically.
* Used SQL joins to retrieve related information from multiple tables.
* Updated the EJS templates to display database records.
* Added automated tests and database error handling.
* Verified the application using a real PostgreSQL connection.

### Database Records

The database currently contains:

| Data                          | Total |
| ----------------------------- | ----: |
| Organizations                 |     3 |
| Service Projects              |    15 |
| Categories                    |     4 |
| Project-Category Associations |    25 |

Each organization has five service projects, and every project is associated with at least one category.

## Week 03 — MVC, Middleware, and Detail Pages

In Week 03, I organized request handling with the Model-View-Controller (MVC) pattern. Express routes are registered in `src/routes.js`, controllers coordinate models and EJS views, and SQL remains in the model files.

The application logs HTTP requests in development, shares `NODE_ENV` with EJS, and uses custom 404 and 500 pages. Detailed errors are shown only in development; production responses use generic messages.

The Organizations, Service Projects, and Categories pages now link to database-backed detail pages. Project details link to their sponsoring organization and show linked category tags. The Service Projects page displays up to five projects scheduled for today or later, ordered by date.

The Week 03 implementation has been verified locally.

## Database Structure

The PostgreSQL database contains four tables that work together to organize the application's information.

| Table              | Description                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `organization`     | Stores organization names, descriptions, contact emails, and logo filenames.                           |
| `project`          | Stores service projects, including their descriptions, locations, dates, and sponsoring organizations. |
| `category`         | Stores the different service categories.                                                               |
| `project_category` | Connects projects to their categories.                                                                 |

### Database Relationships

The database uses two main relationships:

**One-to-Many:** An organization can sponsor several service projects, but each project belongs to one organization.

**Many-to-Many:** A service project can belong to multiple categories, and each category can contain multiple projects. The `project_category` table manages this relationship.

Primary and foreign keys are used to maintain these relationships and protect the consistency of the data.

The complete database schema and sample records are stored in [`src/setup.sql`](src/setup.sql).

## Database Models

To keep the application organized, I separated the database operations into individual model files.

| File                                                         | Purpose                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [`src/models/db.js`](src/models/db.js)                       | Manages PostgreSQL connections, connection pooling, TLS settings, and connection testing. |
| [`src/models/organizations.js`](src/models/organizations.js) | Retrieves organization lists and details.                                                  |
| [`src/models/projects.js`](src/models/projects.js)           | Retrieves upcoming projects, project details, and projects by organization or category.    |
| [`src/models/categories.js`](src/models/categories.js)       | Retrieves category lists and details, and categories associated with projects.              |

Each model handles the database queries related to its purpose. Controllers call model functions and pass their results to EJS templates for rendering.

## Getting Started

To run the application locally, you will need Node.js, npm, and access to a PostgreSQL database.

### 1. Clone the Repository

Open a terminal and run:

```powershell
git clone https://github.com/Prosper-Anosike/cse340-course-repo.git
cd cse340-course-repo
```

### 2. Install Dependencies

Install the required packages:

```powershell
npm install
```

### 3. Configure the Environment

Create a `.env` file in the root directory of the project.

Add the required environment variables using the instructions in the next section.

### 4. Start the Application

Run the development server:

```powershell
npm run dev
```

Open the website in your browser:

http://localhost:3000

To run the application using the production startup command:

```powershell
npm start
```

The application uses the `PORT` environment variable when one is provided. Otherwise, it runs on port `3000`.

## Environment Configuration

Database credentials and environment-specific settings are managed through environment variables.

The `.env` file is excluded from Git, so private connection details are not included in the public repository.

### Local Development

For local development, use the PostgreSQL **External Database URL**.

Create a `.env` file containing:

```dotenv
DB_URL=YOUR_EXTERNAL_POSTGRES_URL
NODE_ENV=development
ENABLE_SQL_LOGGING=false
```

Replace `YOUR_EXTERNAL_POSTGRES_URL` with the connection URL provided by your PostgreSQL database service.

The `DB_SSL_ALLOW_SELF_SIGNED_INTERNAL` setting should remain unset or `false` when connecting through the external database URL.

`ENABLE_SQL_LOGGING` is optional. When enabled, it logs SQL statements to assist with debugging without displaying database credentials or query parameter values.

### Render Production

For the deployed application, configure the following environment variables in the Render dashboard:

```dotenv
DB_URL=YOUR_INTERNAL_RENDER_POSTGRES_URL
NODE_ENV=production
DB_SSL_ALLOW_SELF_SIGNED_INTERNAL=true
ENABLE_SQL_LOGGING=false
```

The `DB_URL` value should contain the PostgreSQL **Internal Database URL** provided by Render.

The application uses TLS for database connections. Its configuration permits self-signed certificates only when the internal Render PostgreSQL connection is recognized and the production setting is explicitly enabled. External connections continue to use strict certificate verification.

Render automatically provides the `PORT` environment variable.

**Security Note:** Database passwords, private connection URLs, and other credentials should never be committed to GitHub or included in application logs.

## Database Setup

The SQL script in [`src/setup.sql`](src/setup.sql) contains the statements needed to create the database tables and insert the initial sample data.

To set up a new database:

1. Create a PostgreSQL database on Render or another compatible PostgreSQL service.
2. Open pgAdmin and connect to the database using its connection details.
3. Select the database and open the Query Tool.
4. Open `src/setup.sql` and load its SQL statements into the Query Tool.
5. Execute the script to create the tables and insert the sample records.
6. Refresh the Tables folder and confirm that all four tables have been created.
7. Verify that the organization, project, category, and relationship records were inserted correctly.

The setup script uses conflict handling to support repeated execution and does not contain destructive `DROP TABLE` statements. However, it should still be reviewed before running it against a database that already contains information.

Render's Free PostgreSQL plan has a limited database lifetime. Keeping the SQL setup script in the repository makes it easier to recreate the database structure and sample records when necessary.

## Testing

I added automated tests to check the application's functionality and help identify problems before deployment.

To run the tests:

```powershell
npm test
```

The automated tests cover:

* Express routes and HTTP responses.
* EJS rendering, detail routes, category tags, and database-backed page content using mocked query results.
* Database schema expectations.
* Database connection and TLS configuration behavior.
* Error handling when database operations fail.

**Latest automated test results (November 9, 2026):**

* 23 tests passed.
* 0 tests failed.
* 0 dependency vulnerabilities reported by `npm audit`.

In addition to the automated tests, I tested the application locally using an actual PostgreSQL database connection.

The database checks confirmed that all required records and relationships were present and that the application could retrieve and display them correctly.

## Deployment on Render

The application is hosted on Render and connected to the GitHub repository.

### Web Service Configuration

| Setting        | Configuration |
| -------------- | ------------- |
| Runtime        | Node          |
| Branch         | `main`        |
| Root Directory | Empty         |
| Build Command  | `npm install` |
| Start Command  | `npm start`   |
| Instance Type  | Free          |
| Environment    | Production    |
| Auto Deploy    | On Commit     |

The PostgreSQL database is also hosted on Render, allowing the application to retrieve the information needed for its pages.

### Live Website

The application is available at:

**https://cse340-prosper.onrender.com/**

The website has four main pages:

| Page             | Link                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Home             | [View Home](https://cse340-prosper.onrender.com/)                       |
| Organizations    | [View Organizations](https://cse340-prosper.onrender.com/organizations) |
| Service Projects | [View Projects](https://cse340-prosper.onrender.com/projects)           |
| Categories       | [View Categories](https://cse340-prosper.onrender.com/categories)       |

### Live Website Verification

On November 3, 2026, I reviewed the deployed website in my browser and confirmed that the main pages displayed the expected Week 02 content.

The Organizations page displayed all three organizations with their descriptions, contact emails, and logos. The Service Projects page displayed all 15 projects, including their descriptions, dates, locations, and sponsoring organizations. The Categories page also displayed all four service categories.

The pages maintained consistent styling and navigation, and the application displayed the expected information from the database integration.

For future deployments, I will continue checking Render's deployment status and confirming that the intended GitHub commit is live.

## Project Progress

This repository contains my coursework and ongoing development for CSE 340.

* **Week 01:** Initial website creation, Express routing, EJS templates, responsive styling, and deployment.
* **Week 02:** PostgreSQL database integration, relational database design, dynamic data retrieval, and database-driven EJS rendering.
* **Week 03:** MVC structure, development middleware, custom error pages, upcoming projects, organization/project/category details, and project-category navigation.

Future coursework will build on this foundation with database updates, validation, authentication, and additional backend functionality.

---

Developed as part of **BYU-Idaho's CSE 340 Web Backend Development course**.
