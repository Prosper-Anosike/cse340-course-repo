import { Router } from 'express';
import {
	processAssignCategoriesForm,
	categoryValidation,
	processEditCategoryForm,
	processNewCategoryForm,
	showAssignCategoriesForm,
	showCategoriesPage,
	showCategoryDetailsPage,
	showEditCategoryForm,
	showNewCategoryForm,
} from './controllers/categories.js';
import { testErrorPage } from './controllers/errors.js';
import { showHomePage } from './controllers/index.js';
import {
	editOrganizationValidation,
	organizationValidation,
	processEditOrganizationForm,
	processNewOrganizationForm,
	showEditOrganizationForm,
	showNewOrganizationForm,
	showOrganizationDetailsPage,
	showOrganizationsPage,
} from './controllers/organizations.js';
import {
	processNewProjectForm,
	processEditProjectForm,
	projectValidation,
	showEditProjectForm,
	showNewProjectForm,
	showProjectDetailsPage,
	showProjectsPage,
} from './controllers/projects.js';
import {
	processLoginForm,
	processLogout,
	processUserRegistrationForm,
	requireLogin,
	requireRole,
	registrationValidation,
	showDashboard,
	showLoginForm,
	showUsersPage,
	showUserRegistrationForm,
} from './controllers/users.js';

const router = Router();

router.get('/', showHomePage);
router.get('/organizations', showOrganizationsPage);
router.get('/new-organization', requireLogin, requireRole('admin'), showNewOrganizationForm);
router.post('/new-organization', requireLogin, requireRole('admin'), organizationValidation, processNewOrganizationForm);
router.get('/edit-organization/:id', requireLogin, requireRole('admin'), showEditOrganizationForm);
router.post('/edit-organization/:id', requireLogin, requireRole('admin'), editOrganizationValidation, processEditOrganizationForm);
router.get('/organization/:id', showOrganizationDetailsPage);
router.get('/projects', showProjectsPage);
router.get('/new-project', requireLogin, requireRole('admin'), showNewProjectForm);
router.post('/new-project', requireLogin, requireRole('admin'), projectValidation, processNewProjectForm);
router.get('/project/:id', showProjectDetailsPage);
router.get('/edit-project/:id', requireLogin, requireRole('admin'), showEditProjectForm);
router.post('/edit-project/:id', requireLogin, requireRole('admin'), projectValidation, processEditProjectForm);
router.get('/categories', showCategoriesPage);
router.get('/new-category', requireLogin, requireRole('admin'), showNewCategoryForm);
router.post('/new-category', requireLogin, requireRole('admin'), categoryValidation, processNewCategoryForm);
router.get('/category/:id', showCategoryDetailsPage);
router.get('/edit-category/:id', requireLogin, requireRole('admin'), showEditCategoryForm);
router.post('/edit-category/:id', requireLogin, requireRole('admin'), categoryValidation, processEditCategoryForm);
router.get('/register', showUserRegistrationForm);
router.post('/register', registrationValidation, processUserRegistrationForm);
router.get('/login', showLoginForm);
router.post('/login', processLoginForm);
router.get('/logout', processLogout);
router.get('/dashboard', requireLogin, showDashboard);
router.get('/users', requireLogin, requireRole('admin'), showUsersPage);
router.get('/assign-categories/:projectId', requireLogin, requireRole('admin'), showAssignCategoriesForm);
router.post('/assign-categories/:projectId', requireLogin, requireRole('admin'), processAssignCategoriesForm);
router.get('/test-error', testErrorPage);

export default router;