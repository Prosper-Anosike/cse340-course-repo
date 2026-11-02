import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

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

app.get('/organizations', (_request, response) => {
  response.render('organizations', {
    title: 'Organizations',
    headingStart: 'Partner',
    headingEmphasis: 'Organizations',
    currentPath: '/organizations',
  });
});

app.get('/projects', (_request, response) => {
  response.render('projects', {
    title: 'Service Projects',
    heading: 'Upcoming Service Projects',
    currentPath: '/projects',
  });
});

app.get('/categories', (_request, response) => {
  response.render('categories', {
    title: 'Categories',
    headingStart: 'Choose your',
    headingEmphasis: 'cause.',
    currentPath: '/categories',
  });
});

export default app;
