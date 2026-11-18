import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import flash from './middleware/flash.js';
import { createSessionMiddleware } from './middleware/session.js';
import router from './routes.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', path.join(currentDirectory, 'views'));
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use((request, response, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.info(`${request.method} ${request.originalUrl}`);
  }

  response.locals.NODE_ENV = process.env.NODE_ENV;
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(createSessionMiddleware());
app.use(flash);
app.use(express.static(path.join(currentDirectory, '..', 'public')));
app.use(router);

app.use((request, response) => {
  response.status(404).render('errors/404', {
    title: 'Page Not Found',
    currentPath: request.path,
  });
});

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  console.error('Unhandled request error:', error);
  const errorDetails = process.env.NODE_ENV === 'development'
    ? error.stack ?? error.message
    : '';

  response.status(500).render('errors/500', {
    title: 'Server Error',
    currentPath: '',
    errorDetails,
  });
});

export default app;
