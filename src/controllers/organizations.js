import { safeDatabaseErrorCode } from '../models/db.js';
import { getAllOrganizations, getOrganizationDetails } from '../models/organizations.js';
import { getProjectsByOrganizationId } from '../models/projects.js';

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

const showOrganizationsPage = async (_request, response) => {
  try {
    const organizations = await getAllOrganizations();
    response.render('organizations', {
      title: 'Organizations',
      headingStart: 'Partner',
      headingEmphasis: 'Organizations',
      currentPath: '/organizations',
      organizations,
    });
  } catch (error) {
    console.error(`Unable to load organizations data (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showOrganizationDetailsPage = async (request, response) => {
  const organizationId = getPositiveId(request.params.id);

  if (organizationId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const organization = await getOrganizationDetails(organizationId);

    if (!organization) {
      return showNotFoundPage(request, response);
    }

    const projects = await getProjectsByOrganizationId(organizationId);
    response.render('organization', {
      title: organization.name,
      currentPath: '/organizations',
      organization,
      projects,
    });
  } catch (error) {
    console.error(`Unable to load organization details (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

export { showOrganizationDetailsPage, showOrganizationsPage };