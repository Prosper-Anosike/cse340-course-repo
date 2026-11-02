# CSE 340 Course Repository

BYU-Idaho CSE 340 Web Backend Development coursework and projects.

## Week 01 Site

The Week 01 CSE 340 Service Network site uses Node.js, Express, and EJS.

## Live Website

The deployed site is available at [https://cse340-prosper.onrender.com/](https://cse340-prosper.onrender.com/).

## Week 01 Features

- Node.js and Express backend.
- EJS templates with reusable header and footer partials.
- Home, Organizations, Service Projects, and Categories pages.
- Responsive CSS and official course images.
- Deployed on Render.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. To run the production server, use `npm start`. The server uses `PORT` when set and otherwise listens on port 3000. Create a local `.env` file for development-only environment variables; it is excluded from Git.

Run the route and static asset checks with `npm test`.

Render settings: Node language, `main` branch, empty root directory, `npm install` build command, `npm start` start command, Free instance, `NODE_ENV=production`, and Auto Deploy on commit.
