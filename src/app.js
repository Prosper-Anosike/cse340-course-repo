import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', path.join(currentDirectory, 'views'));
app.use(express.static(path.join(currentDirectory, '..', 'public')));

app.get('/', (_request, response) => {
  response.render('home', { title: 'Home', currentPath: '/' });
});

app.get('/organizations', (_request, response) => {
  response.render('organizations', { title: 'Organizations', currentPath: '/organizations' });
});

app.get('/projects', (_request, response) => {
  response.render('projects', { title: 'Service Projects', currentPath: '/projects' });
});

app.get('/categories', (_request, response) => {
  response.render('categories', { title: 'Categories', currentPath: '/categories' });
});

export default app;
