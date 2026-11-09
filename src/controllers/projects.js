import { safeDatabaseErrorCode } from '../models/db.js';
import { getCategoriesByProjectId } from '../models/categories.js';
import { getProjectDetails, getUpcomingProjects } from '../models/projects.js';

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

export { showProjectDetailsPage, showProjectsPage };