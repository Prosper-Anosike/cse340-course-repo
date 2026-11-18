import { body, matchedData, validationResult } from 'express-validator';
import { safeDatabaseErrorCode } from '../models/db.js';
import { createOrganization, getAllOrganizations, getOrganizationDetails, updateOrganization } from '../models/organizations.js';
import { getProjectsByOrganizationId } from '../models/projects.js';

const organizationValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Organization name is required.')
    .bail()
    .isLength({ min: 3, max: 150 }).withMessage('Organization name must be between 3 and 150 characters.'),
  body('description')
    .trim()
    .notEmpty().withMessage('Organization description is required.')
    .bail()
    .isLength({ max: 500 }).withMessage('Organization description must be no more than 500 characters.'),
  body('contactEmail')
    .trim()
    .notEmpty().withMessage('Contact email is required.')
    .bail()
    .isLength({ max: 255 }).withMessage('Contact email must be no more than 255 characters.')
    .bail()
    .isEmail().withMessage('Enter a valid contact email address.')
    .bail()
    .normalizeEmail(),
];

const editOrganizationValidation = [
  ...organizationValidation,
  body('logoFilename')
    .trim()
    .notEmpty().withMessage('Logo filename is required.')
    .bail()
    .isLength({ max: 255 }).withMessage('Logo filename must be no more than 255 characters.'),
];

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

const showNewOrganizationForm = (_request, response) => {
  response.render('new-organization', {
    title: 'Add an Organization',
    currentPath: '/organizations',
  });
};

const processNewOrganizationForm = async (request, response) => {
  const validationErrors = validationResult(request);

  if (!validationErrors.isEmpty()) {
    for (const error of validationErrors.array()) {
      request.flash('error', error.msg);
    }

    return response.redirect('/new-organization');
  }

  const { name, description, contactEmail } = matchedData(request);

  try {
    const organizationId = await createOrganization(name, description, contactEmail, 'placeholder-logo.png');

    if (!organizationId) {
      throw new Error('Organization insert did not return an ID.');
    }

    request.flash('success', 'Organization created successfully.');
    response.redirect(`/organization/${organizationId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'An organization with this name already exists.');
      return response.redirect('/new-organization');
    }

    console.error(`Unable to create organization (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showEditOrganizationForm = async (request, response) => {
  const organizationId = getPositiveId(request.params.id);

  if (organizationId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const organization = await getOrganizationDetails(organizationId);

    if (!organization) {
      return showNotFoundPage(request, response);
    }

    response.render('edit-organization', {
      title: 'Edit Organization',
      currentPath: '/organizations',
      organization,
    });
  } catch (error) {
    console.error(`Unable to load organization for editing (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processEditOrganizationForm = async (request, response) => {
  const organizationId = getPositiveId(request.params.id);

  if (organizationId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const existingOrganization = await getOrganizationDetails(organizationId);

    if (!existingOrganization) {
      return showNotFoundPage(request, response);
    }

    const validationErrors = validationResult(request);

    if (!validationErrors.isEmpty()) {
      for (const error of validationErrors.array()) {
        request.flash('error', error.msg);
      }

      return response.redirect(`/edit-organization/${organizationId}`);
    }

    const { name, description, contactEmail, logoFilename } = matchedData(request);
    const updatedOrganizationId = await updateOrganization(
      organizationId,
      name,
      description,
      contactEmail,
      logoFilename,
    );

    if (!updatedOrganizationId) {
      return showNotFoundPage(request, response);
    }

    request.flash('success', 'Organization updated successfully.');
    response.redirect(`/organization/${updatedOrganizationId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'An organization with this name already exists.');
      return response.redirect(`/edit-organization/${organizationId}`);
    }

    console.error(`Unable to update organization (${safeDatabaseErrorCode(error)}). Verify database availability.`);
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

export {
  editOrganizationValidation,
  organizationValidation,
  processEditOrganizationForm,
  processNewOrganizationForm,
  showEditOrganizationForm,
  showNewOrganizationForm,
  showOrganizationDetailsPage,
  showOrganizationsPage,
};