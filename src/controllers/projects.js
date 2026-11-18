import { body, matchedData, validationResult } from 'express-validator';
import { getAllOrganizations, getOrganizationDetails } from '../models/organizations.js';
import { safeDatabaseErrorCode } from '../models/db.js';
import { getCategoriesByProjectId } from '../models/categories.js';
import { createProject, getProjectDetails, getUpcomingProjects, updateProject } from '../models/projects.js';

const NUMBER_OF_UPCOMING_PROJECTS = 5;

const showNotFoundPage = (request, response) => response.status(404).render('errors/404', {
  title: 'Page Not Found',
  currentPath: request.path,
});

const getPositiveId = (value) => {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const projectValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Project title is required.')
    .bail()
    .isLength({ min: 3, max: 150 }).withMessage('Project title must be between 3 and 150 characters.'),
  body('description')
    .trim()
    .notEmpty().withMessage('Project description is required.')
    .bail()
    .isLength({ max: 1000 }).withMessage('Project description must be no more than 1000 characters.'),
  body('location')
    .trim()
    .notEmpty().withMessage('Project location is required.')
    .bail()
    .isLength({ max: 200 }).withMessage('Project location must be no more than 200 characters.'),
  body('date')
    .trim()
    .notEmpty().withMessage('Project date is required.')
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Enter a valid project date.')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true }).withMessage('Enter a valid project date.'),
  body('organizationId')
    .trim()
    .notEmpty().withMessage('Select a sponsoring organization.')
    .bail()
    .isInt({ min: 1 }).withMessage('Select a valid sponsoring organization.')
    .bail()
    .toInt()
    .custom(async (organizationId) => {
      let organization;

      try {
        organization = await getOrganizationDetails(organizationId);
      } catch (error) {
        console.error(`Unable to validate project organization (${safeDatabaseErrorCode(error)}).`);
        throw new Error('The sponsoring organization could not be verified. Please try again.');
      }

      if (!organization) {
        throw new Error('Select an existing sponsoring organization.');
      }
    }),
];

const showProjectsPage = async (_request, response) => {
  try {
    const projects = await getUpcomingProjects(NUMBER_OF_UPCOMING_PROJECTS);
    response.render('projects', {
      title: 'Service Projects',
      heading: 'Upcoming Service Projects',
      currentPath: '/projects',
      projects,
    });
  } catch (error) {
    console.error(`Unable to load projects data (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showNewProjectForm = async (_request, response) => {
  try {
    const organizations = await getAllOrganizations();
    response.render('new-project', {
      title: 'Add a Service Project',
      currentPath: '/projects',
      organizations,
    });
  } catch (error) {
    console.error(`Unable to load organizations for the project form (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processNewProjectForm = async (request, response) => {
  const validationErrors = validationResult(request);

  if (!validationErrors.isEmpty()) {
    for (const error of validationErrors.array()) {
      request.flash('error', error.msg);
    }

    return response.redirect('/new-project');
  }

  const { title, description, location, date, organizationId } = matchedData(request);

  try {
    const projectId = await createProject(title, description, location, date, organizationId);

    if (!projectId) {
      throw new Error('Project insert did not return an ID.');
    }

    request.flash('success', 'Service project created successfully.');
    response.redirect(`/project/${projectId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'A project with this title already exists for that organization.');
      return response.redirect('/new-project');
    }

    console.error(`Unable to create project (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showEditProjectForm = async (request, response) => {
  const projectId = getPositiveId(request.params.id);

  if (projectId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const project = await getProjectDetails(projectId);

    if (!project) {
      return showNotFoundPage(request, response);
    }

    const organizations = await getAllOrganizations();
    response.render('edit-project', {
      title: 'Edit Service Project',
      currentPath: '/projects',
      project,
      organizations,
    });
  } catch (error) {
    console.error(`Unable to load project for editing (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processEditProjectForm = async (request, response) => {
  const projectId = getPositiveId(request.params.id);

  if (projectId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const project = await getProjectDetails(projectId);

    if (!project) {
      return showNotFoundPage(request, response);
    }

    const validationErrors = validationResult(request);

    if (!validationErrors.isEmpty()) {
      for (const error of validationErrors.array()) {
        request.flash('error', error.msg);
      }

      return response.redirect(`/edit-project/${projectId}`);
    }

    const { title, description, location, date, organizationId } = matchedData(request);
    const updatedProjectId = await updateProject(projectId, title, description, location, date, organizationId);

    if (!updatedProjectId) {
      return showNotFoundPage(request, response);
    }

    request.flash('success', 'Service project updated successfully.');
    response.redirect(`/project/${updatedProjectId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'A project with this title already exists for that organization.');
      return response.redirect(`/edit-project/${projectId}`);
    }

    console.error(`Unable to update project (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showProjectDetailsPage = async (request, response) => {
  const projectId = getPositiveId(request.params.id);

  if (projectId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const project = await getProjectDetails(projectId);

    if (!project) {
      return showNotFoundPage(request, response);
    }

    const categories = await getCategoriesByProjectId(projectId);
    response.render('project', {
      title: project.title,
      currentPath: '/projects',
      project,
      categories,
    });
  } catch (error) {
    console.error(`Unable to load project details (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

export {
  processEditProjectForm,
  processNewProjectForm,
  projectValidation,
  showEditProjectForm,
  showNewProjectForm,
  showProjectDetailsPage,
  showProjectsPage,
};