import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllCategories } from './models/categories.js';
import { getAllOrganizations } from './models/organizations.js';
import { getAllProjects } from './models/projects.js';
import { safeDatabaseErrorCode } from './models/db.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseUnavailableMessage = 'Service data is temporarily unavailable.';

const renderDatabasePage = (view, collectionName, getRecords, pageLocals) => async (_request, response) => {
  try {
    const records = await getRecords();
    response.render(view, { ...pageLocals, [collectionName]: records });
  } catch (error) {
    console.error(`Unable to load ${view} data (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send(databaseUnavailableMessage);
  }
};

app.set('view engine', 'ejs');
app.set('views', path.join(currentDirectory, 'views'));
app.use(express.static(path.join(currentDirectory, '..', 'public')));

app.get('/', (_request, response) => {
  response.render('home', {
    title: 'Home',
    heading: 'Welcome to the CSE 340 Service Network!',
    currentPath: '/',
  });
});

app.get('/organizations', renderDatabasePage('organizations', 'organizations', getAllOrganizations, {
    title: 'Organizations',
    headingStart: 'Partner',
    headingEmphasis: 'Organizations',
    currentPath: '/organizations',
}));

app.get('/projects', renderDatabasePage('projects', 'projects', getAllProjects, {
    title: 'Service Projects',
    heading: 'Upcoming Service Projects',
    currentPath: '/projects',
}));

app.get('/categories', renderDatabasePage('categories', 'categories', getAllCategories, {
    title: 'Categories',
    headingStart: 'Choose your',
    headingEmphasis: 'cause.',
    currentPath: '/categories',
}));

export default app;
