import { Router } from 'express';
import { showCategoriesPage, showCategoryDetailsPage } from './controllers/categories.js';
import { testErrorPage } from './controllers/errors.js';
import { showHomePage } from './controllers/index.js';
import { showOrganizationDetailsPage, showOrganizationsPage } from './controllers/organizations.js';
import { showProjectDetailsPage, showProjectsPage } from './controllers/projects.js';

const router = Router();

router.get('/', showHomePage);
router.get('/organizations', showOrganizationsPage);
router.get('/organization/:id', showOrganizationDetailsPage);
router.get('/projects', showProjectsPage);
router.get('/project/:id', showProjectDetailsPage);
router.get('/categories', showCategoriesPage);
router.get('/category/:id', showCategoryDetailsPage);
router.get('/test-error', testErrorPage);

export default router;