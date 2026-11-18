import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, mock, test } from 'node:test';
import { createPoolConfig, createTransactionRunner, database, testConnection } from '../src/models/db.js';
import { createCategory, getAllCategories, getCategoriesByProjectId, getCategoryDetails, updateCategory, updateCategoryAssignments } from '../src/models/categories.js';
import { createOrganization, getAllOrganizations, getOrganizationDetails, updateOrganization } from '../src/models/organizations.js';
import { createProject, getAllProjects, getProjectDetails, getProjectsByCategoryId, getProjectsByOrganizationId, getUpcomingProjects, updateProject } from '../src/models/projects.js';
import { createSessionMiddleware } from '../src/middleware/session.js';

const originalSessionSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
const { default: app } = await import('../src/app.js');
if (originalSessionSecret === undefined) {
  delete process.env.SESSION_SECRET;
} else {
  process.env.SESSION_SECRET = originalSessionSecret;
}

let server;
let baseUrl;
let queryMock;
let transactionMock;
let failDatabaseQueries = false;
let escapeOrganizationDescription = false;
const createdOrganizations = [];
const createdProjects = [];
let lastOrganizationInsert;
let lastOrganizationUpdate;
let organizationUpdateCount = 0;
let lastProjectInsert;
let lastProjectUpdate;
let projectUpdateCount = 0;
let transactionEvents = [];
let failCategoryAssignmentAt = null;
const createdCategories = [];
let lastCategoryInsert;
let lastCategoryUpdate;
const updatedCategoryNames = new Map();

const organizations = [
  {
    organizationId: 1,
    name: 'BrightFuture Builders',
    description: 'A nonprofit focused on improving community infrastructure through sustainable construction projects.',
    contactEmail: 'info@brightfuturebuilders.org',
    logoFilename: 'brightfuture-logo.png',
  },
  {
    organizationId: 2,
    name: 'GreenHarvest Growers',
    description: 'An urban farming collective promoting food sustainability and education in local neighborhoods.',
    contactEmail: 'contact@greenharvest.org',
    logoFilename: 'greenharvest-logo.png',
  },
  {
    organizationId: 3,
    name: 'UnityServe Volunteers',
    description: 'A volunteer coordination group supporting local charities and service initiatives.',
    contactEmail: 'hello@unityserve.org',
    logoFilename: 'unityserve-logo.png',
  },
];

const projects = [
  {
    projectId: 1,
    organizationId: 3,
    title: 'Park Cleanup',
    description: 'Join us to clean up local parks and make them beautiful!',
    location: 'Riverside Park',
    projectDate: 'December 7, 2026',
    organizationName: 'UnityServe Volunteers',
  },
  {
    projectId: 2,
    organizationId: 3,
    title: 'Food Drive',
    description: 'Help collect and distribute food to those in need.',
    location: 'Central Community Pantry',
    projectDate: 'December 14, 2026',
    organizationName: 'UnityServe Volunteers',
  },
  {
    projectId: 3,
    organizationId: 3,
    title: 'Community Tutoring',
    description: 'Volunteer to tutor students in various subjects.',
    location: 'Civic Learning Center',
    projectDate: 'January 11, 2027',
    organizationName: 'UnityServe Volunteers',
  },
  {
    projectId: 4,
    organizationId: 1,
    title: 'Community Center Access Ramp',
    description: 'Build an accessible entrance ramp and improve entryways at a neighborhood community center.',
    location: 'Maplewood Community Center',
    projectDate: 'December 5, 2026',
    organizationName: 'BrightFuture Builders',
  },
  {
    projectId: 5,
    organizationId: 2,
    title: 'Community Garden Planting Day',
    description: 'Prepare garden beds and plant seasonal vegetables for a shared neighborhood harvest.',
    location: 'Eastside Community Garden',
    projectDate: 'December 6, 2026',
    organizationName: 'GreenHarvest Growers',
  },
  {
    projectId: 6,
    organizationId: 1,
    title: 'Neighborhood Playground Renewal',
    description: 'Repair playground equipment and renew the safety surface with durable materials.',
    location: 'Cedar Grove Park',
    projectDate: 'December 12, 2026',
    organizationName: 'BrightFuture Builders',
  },
  {
    projectId: 7,
    organizationId: 2,
    title: 'School Garden Learning Beds',
    description: 'Build and plant outdoor learning beds for local students and teachers.',
    location: 'Lincoln Elementary School',
    projectDate: 'December 13, 2026',
    organizationName: 'GreenHarvest Growers',
  },
  {
    projectId: 8,
    organizationId: 1,
    title: 'Solar Bus Shelter Build',
    description: 'Assemble a solar-lit shelter that makes a neighborhood transit stop safer and more useful.',
    location: 'Westside Transit Plaza',
    projectDate: 'January 9, 2027',
    organizationName: 'BrightFuture Builders',
  },
  {
    projectId: 9,
    organizationId: 2,
    title: 'Harvest Box Packing',
    description: 'Sort and pack fresh produce boxes for families in nearby neighborhoods.',
    location: 'GreenHarvest Farm Hub',
    projectDate: 'January 10, 2027',
    organizationName: 'GreenHarvest Growers',
  },
  {
    projectId: 10,
    organizationId: 1,
    title: 'Safe Sidewalk Repair Day',
    description: 'Repair damaged sidewalk sections to improve safe access for pedestrians and mobility devices.',
    location: 'North Park District',
    projectDate: 'January 16, 2027',
    organizationName: 'BrightFuture Builders',
  },
  {
    projectId: 11,
    organizationId: 2,
    title: 'Composting Basics Workshop',
    description: 'Teach residents how to turn food scraps into useful compost for home and community gardens.',
    location: 'Eastside Community Garden',
    projectDate: 'January 17, 2027',
    organizationName: 'GreenHarvest Growers',
  },
  {
    projectId: 12,
    organizationId: 3,
    title: 'Neighborhood Wellness Fair',
    description: 'Help local providers connect residents with free wellness resources and screenings.',
    location: 'Southside Recreation Hall',
    projectDate: 'January 18, 2027',
    organizationName: 'UnityServe Volunteers',
  },
  {
    projectId: 13,
    organizationId: 1,
    title: 'Sustainable Building Workshop',
    description: 'Introduce residents to practical low-waste construction and home improvement techniques.',
    location: 'Community Build Lab',
    projectDate: 'January 23, 2027',
    organizationName: 'BrightFuture Builders',
  },
  {
    projectId: 14,
    organizationId: 2,
    title: 'Pollinator Garden Planting',
    description: 'Plant native flowers that support pollinators around a shared growing space.',
    location: 'Riverside Learning Garden',
    projectDate: 'January 24, 2027',
    organizationName: 'GreenHarvest Growers',
  },
  {
    projectId: 15,
    organizationId: 3,
    title: 'Senior Center Meal Delivery',
    description: 'Prepare and deliver balanced meals to neighbors served by the senior center.',
    location: 'Unity Senior Center',
    projectDate: 'January 25, 2027',
    organizationName: 'UnityServe Volunteers',
  },
];

const upcomingProjects = [...projects]
  .sort((firstProject, secondProject) => (
    Date.parse(firstProject.projectDate) - Date.parse(secondProject.projectDate)
    || firstProject.projectId - secondProject.projectId
  ))
  .slice(0, 5);

const categories = [
  { categoryId: 1, name: 'Environmental' },
  { categoryId: 2, name: 'Educational' },
  { categoryId: 3, name: 'Community Service' },
  { categoryId: 4, name: 'Health and Wellness' },
];

const projectCategoryAssociations = [
  [4, 3], [6, 3], [8, 1], [8, 3], [10, 3], [13, 1], [13, 2],
  [5, 1], [5, 3], [7, 1], [7, 2], [9, 3], [11, 1], [11, 2], [14, 1], [14, 2],
  [1, 1], [1, 3], [2, 3], [2, 4], [3, 2], [12, 4], [12, 3], [15, 4], [15, 3],
];

let mockedProjectCategoryAssociations = projectCategoryAssociations.map((association) => [...association]);

const mockedQuery = async (statement, values = []) => {
  if (failDatabaseQueries) {
    const error = new Error('Sensitive database failure detail must not be sent to clients.');
    error.code = 'ECONNRESET';
    throw error;
  }

  const normalizedStatement = statement.toLowerCase();

  if (normalizedStatement.includes('insert into organization')) {
    lastOrganizationInsert = { statement, values };
    if ([...organizations, ...createdOrganizations].some((organization) => organization.name === values[0])) {
      const error = new Error('Duplicate organization name.');
      error.code = '23505';
      throw error;
    }

    const organization = {
      organizationId: organizations.length + createdOrganizations.length + 1,
      name: values[0],
      description: values[1],
      contactEmail: values[2],
      logoFilename: values[3],
    };
    createdOrganizations.push(organization);
    return { rows: [{ organizationId: organization.organizationId }] };
  }

  if (normalizedStatement.includes('update organization')) {
    lastOrganizationUpdate = { statement, values };
    organizationUpdateCount += 1;
    const organization = [...organizations, ...createdOrganizations]
      .find((record) => record.organizationId === values[0]);

    if ([...organizations, ...createdOrganizations].some((record) => (
      record.organizationId !== values[0] && record.name === values[1]
    ))) {
      const error = new Error('Duplicate organization name.');
      error.code = '23505';
      throw error;
    }

    return { rows: organization ? [{ organizationId: organization.organizationId }] : [] };
  }

  if (normalizedStatement.includes('insert into project')) {
    lastProjectInsert = { statement, values };
    if ([...projects, ...createdProjects].some((project) => (
      project.organizationId === values[4] && project.title === values[0]
    ))) {
      const error = new Error('Duplicate project title for organization.');
      error.code = '23505';
      throw error;
    }

    const organization = organizations.find((record) => record.organizationId === values[4]);
    const project = {
      projectId: projects.length + createdProjects.length + 1,
      title: values[0],
      description: values[1],
      location: values[2],
      projectDate: new Date(`${values[3]}T00:00:00.000Z`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      projectDateISO: values[3],
      organizationId: values[4],
      organizationName: organization?.name,
    };
    createdProjects.push(project);
    return { rows: [{ projectId: project.projectId }] };
  }

  if (normalizedStatement.includes('update project')) {
    lastProjectUpdate = { statement, values };
    projectUpdateCount += 1;
    const project = [...projects, ...createdProjects].find((record) => record.projectId === values[0]);

    if ([...projects, ...createdProjects].some((record) => (
      record.projectId !== values[0]
      && record.organizationId === values[5]
      && record.title === values[1]
    ))) {
      const error = new Error('Duplicate project title for organization.');
      error.code = '23505';
      throw error;
    }

    return { rows: project ? [{ projectId: project.projectId }] : [] };
  }

  if (normalizedStatement.includes('insert into category')) {
    lastCategoryInsert = { statement, values };
    if ([...categories, ...createdCategories].some((category) => category.name === values[0])) {
      const error = new Error('Duplicate category name.');
      error.code = '23505';
      throw error;
    }

    const category = { categoryId: categories.length + createdCategories.length + 1, name: values[0] };
    createdCategories.push(category);
    return { rows: [{ categoryId: category.categoryId }] };
  }

  if (normalizedStatement.includes('update category')) {
    lastCategoryUpdate = { statement, values };
    const category = categories.find((record) => record.categoryId === values[0]);

    if (!category) {
      return { rows: [] };
    }

    if ([...categories, ...createdCategories].some((record) => (
      record.categoryId !== values[0] && record.name === values[1]
    ))) {
      const error = new Error('Duplicate category name.');
      error.code = '23505';
      throw error;
    }

    updatedCategoryNames.set(category.categoryId, values[1]);
    return { rows: [{ categoryId: category.categoryId }] };
  }

  if (normalizedStatement.includes('from project')) {
    if (normalizedStatement.includes('where project.organization_id = $1')) {
      return { rows: projects.filter((project) => project.organizationId === values[0]) };
    }

    if (normalizedStatement.includes('where project.project_id = $1')) {
      const project = [...projects, ...createdProjects].find((record) => record.projectId === values[0]);
      return {
        rows: project
          ? [{
            ...project,
            projectDateISO: project.projectDateISO ?? new Date(`${project.projectDate} 00:00:00 UTC`).toISOString().slice(0, 10),
          }]
          : [],
      };
    }

    if (normalizedStatement.includes('current_date')) {
      const upcomingProjects = [...projects].sort((firstProject, secondProject) => (
        Date.parse(firstProject.projectDate) - Date.parse(secondProject.projectDate)
        || firstProject.projectId - secondProject.projectId
      ));
      return { rows: upcomingProjects.slice(0, values[0]) };
    }

    if (normalizedStatement.includes('inner join project_category')) {
      const associatedProjectIds = new Set(mockedProjectCategoryAssociations
        .filter(([, categoryId]) => categoryId === values[0])
        .map(([projectId]) => projectId));
      const associatedProjects = projects
        .filter((project) => associatedProjectIds.has(project.projectId))
        .sort((firstProject, secondProject) => (
          Date.parse(firstProject.projectDate) - Date.parse(secondProject.projectDate)
          || firstProject.projectId - secondProject.projectId
        ));
      return { rows: associatedProjects };
    }

    return { rows: projects };
  }

  if (normalizedStatement.includes('from organization')) {
    if (normalizedStatement.includes('where organization_id = $1')) {
      const organization = [...organizations, ...createdOrganizations]
        .find((record) => record.organizationId === values[0]);
      if (!organization) {
        return { rows: [] };
      }

      return {
        rows: [escapeOrganizationDescription
          ? { ...organization, description: '<script>alert("x")</script>' }
          : organization],
      };
    }

    const result = escapeOrganizationDescription
      ? [{ ...organizations[0], description: '<script>alert("x")</script>' }]
      : organizations;
    return { rows: result };
  }

  if (normalizedStatement.includes('from category')) {
    if (normalizedStatement.includes('where category.category_id = $1')) {
      const category = [...categories, ...createdCategories]
        .find((record) => record.categoryId === values[0]);
      return {
        rows: category
          ? [{ ...category, name: updatedCategoryNames.get(category.categoryId) ?? category.name }]
          : [],
      };
    }

    if (normalizedStatement.includes('inner join project_category')) {
      const associatedCategoryIds = new Set(mockedProjectCategoryAssociations
        .filter(([projectId]) => projectId === values[0])
        .map(([, categoryId]) => categoryId));
      return {
        rows: categories
          .filter((category) => associatedCategoryIds.has(category.categoryId))
          .sort((firstCategory, secondCategory) => firstCategory.name.localeCompare(secondCategory.name)),
      };
    }

    return { rows: categories };
  }

  throw new Error('Unexpected mocked SQL query.');
};

const mockedTransaction = async (operation) => {
  let workingAssociations = mockedProjectCategoryAssociations.map((association) => [...association]);
  transactionEvents.push('BEGIN');
  const transaction = {
    query: async (statement, values = []) => {
      const normalizedStatement = statement.toLowerCase();

      if (normalizedStatement.includes('delete from project_category')) {
        transactionEvents.push('DELETE');
        workingAssociations = workingAssociations.filter(([projectId]) => projectId !== values[0]);
        return { rowCount: 1, rows: [] };
      }

      if (normalizedStatement.includes('insert into project_category')) {
        const [projectId, categoryId] = values;
        transactionEvents.push(`INSERT:${categoryId}`);

        if (categoryId === failCategoryAssignmentAt) {
          const error = new Error('Simulated category assignment failure.');
          error.code = 'XX000';
          throw error;
        }

        if (!workingAssociations.some(([assignedProjectId, assignedCategoryId]) => (
          assignedProjectId === projectId && assignedCategoryId === categoryId
        ))) {
          workingAssociations.push([projectId, categoryId]);
        }

        return { rowCount: 1, rows: [] };
      }

      return mockedQuery(statement, values);
    },
  };

  try {
    const result = await operation(transaction);
    mockedProjectCategoryAssociations = workingAssociations;
    transactionEvents.push('COMMIT');
    return result;
  } catch (error) {
    transactionEvents.push('ROLLBACK');
    throw error;
  }
};

before(async () => {
  queryMock = mock.method(database, 'query', mockedQuery);
  transactionMock = mock.method(database, 'transaction', mockedTransaction);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  queryMock.mock.restore();
  transactionMock.mock.restore();
});

for (const [route, pageTitle] of [
  ['/', 'Home'],
  ['/organizations', 'Organizations'],
  ['/projects', 'Service Projects'],
  ['/categories', 'Categories'],
]) {
  test(`${route} renders its title, shared navigation, and footer`, async () => {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, new RegExp(`<title>${pageTitle} \\| CSE 340 Service Network</title>`));
    assert.match(html, /<header class="site-header">/);
    assert.match(html, /<nav class="site-nav" aria-label="Main navigation">/);
    assert.match(html, /<footer class="site-footer">/);
    assert.match(html, /CSE 340 Service Network/);
    assert.match(html, /href="\/"/);
    assert.match(html, /href="\/organizations"/);
    assert.match(html, /href="\/projects"/);
    assert.match(html, /href="\/categories"/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, /&copy; \d{4} CSE 340 Service Network/);
  });
}

test('home page displays the required mission and official course image', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.match(html, /<h1>Welcome to the CSE 340 Service Network!<\/h1>/);
  assert.match(html, /Our mission is to promote service across the world by connecting volunteers with service opportunities in their community\./);
  assert.match(html, /src="\/images\/cse340-service-network\.png"/);
  assert.match(html, /alt="CSE 340 Service Network"/);
  assert.match(html, /<a class="button button-light" href="\/projects">Explore service projects/);
});

test('new organization form exposes accessible client-side constraints', async () => {
  const response = await fetch(`${baseUrl}/new-organization`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<form[^>]+action="\/new-organization"[^>]+method="post"/);
  assert.match(html, /<label for="name">Organization name<\/label>/);
  assert.match(html, /<input id="name" name="name" type="text" required maxlength="150"/);
  assert.doesNotMatch(html, /name="name"[^>]*minlength=/);
  assert.match(html, /<textarea id="description" name="description" required maxlength="500"/);
  assert.match(html, /<input id="contactEmail" name="contactEmail" type="email" required maxlength="255"/);
});

test('invalid organization submissions redirect with one-time errors and do not insert', async () => {
  const initialInsertCount = createdOrganizations.length;
  const response = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: ' a ', description: ' ', contactEmail: 'not-an-email' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/new-organization');
  assert.equal(createdOrganizations.length, initialInsertCount);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);
  const formResponse = await fetch(`${baseUrl}/new-organization`, { headers: { cookie } });
  const formHtml = await formResponse.text();
  assert.equal(formResponse.status, 200);
  assert.match(formHtml, /class="flash-message flash-error" role="alert"/);
  assert.match(formHtml, /Organization name must be between 3 and 150 characters\./);
  assert.match(formHtml, /Organization description is required\./);
  assert.match(formHtml, /Enter a valid contact email address\./);

  const refreshedResponse = await fetch(`${baseUrl}/new-organization`, { headers: { cookie } });
  assert.doesNotMatch(await refreshedResponse.text(), /class="flash-message flash-error"/);

  const overLimitResponse = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'N'.repeat(151), description: 'D'.repeat(501), contactEmail: 'valid@example.com' }),
    redirect: 'manual',
  });
  assert.equal(overLimitResponse.status, 302);
  assert.equal(createdOrganizations.length, initialInsertCount);
  const overLimitCookie = overLimitResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const overLimitHtml = await (await fetch(`${baseUrl}/new-organization`, { headers: { cookie: overLimitCookie } })).text();
  assert.match(overLimitHtml, /Organization name must be between 3 and 150 characters\./);
  assert.match(overLimitHtml, /Organization description must be no more than 500 characters\./);

  const overlongEmail = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Valid Organization',
      description: 'Valid description.',
      contactEmail: `${'a'.repeat(250)}@example.com`,
    }),
    redirect: 'manual',
  });
  assert.equal(overlongEmail.status, 302);
  assert.equal(createdOrganizations.length, initialInsertCount);
  const overlongEmailCookie = overlongEmail.headers.get('set-cookie')?.split(';', 1)[0];
  const overlongEmailHtml = await (await fetch(`${baseUrl}/new-organization`, { headers: { cookie: overlongEmailCookie } })).text();
  assert.match(overlongEmailHtml, /Contact email must be no more than 255 characters\./);
});

test('valid organization form inserts normalized parameters and flashes success once', async () => {
  const response = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: '  Community Partners  ',
      description: '  Connecting neighbors to local service.  ',
      contactEmail: ' Volunteer@Example.com ',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  const createdOrganization = createdOrganizations.at(-1);
  assert.equal(response.headers.get('location'), `/organization/${createdOrganization.organizationId}`);
  assert.deepEqual(lastOrganizationInsert.values, [
    'Community Partners',
    'Connecting neighbors to local service.',
    'volunteer@example.com',
    'placeholder-logo.png',
  ]);
  assert.match(lastOrganizationInsert.statement, /INSERT INTO organization/);
  assert.match(lastOrganizationInsert.statement, /VALUES \(\$1, \$2, \$3, \$4\)/);
  assert.match(lastOrganizationInsert.statement, /RETURNING organization_id/);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);
  const setCookieHeader = response.headers.get('set-cookie');
  const expiry = Date.parse(setCookieHeader.match(/Expires=([^;]+)/i)?.[1] ?? '');
  assert.ok(expiry - Date.now() > 59 * 60 * 1000 && expiry - Date.now() <= 60 * 60 * 1000);
  assert.match(setCookieHeader, /HttpOnly/i);
  const detailsResponse = await fetch(`${baseUrl}${response.headers.get('location')}`, { headers: { cookie } });
  const detailsHtml = await detailsResponse.text();
  assert.equal(detailsResponse.status, 200);
  assert.match(detailsHtml, /class="flash-message flash-success" role="status"/);
  assert.match(detailsHtml, /Organization created successfully\./);

  const refreshedResponse = await fetch(`${baseUrl}${response.headers.get('location')}`, { headers: { cookie } });
  assert.doesNotMatch(await refreshedResponse.text(), /class="flash-message flash-success"/);
});

test('duplicate organization names return a friendly flash on create and edit', async () => {
  const initialOrganizationCount = createdOrganizations.length;
  const createResponse = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'BrightFuture Builders', description: 'Duplicate name.', contactEmail: 'duplicate@example.com' }),
    redirect: 'manual',
  });

  assert.equal(createResponse.status, 302);
  assert.equal(createResponse.headers.get('location'), '/new-organization');
  assert.equal(createdOrganizations.length, initialOrganizationCount);
  const createCookie = createResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const createHtml = await (await fetch(`${baseUrl}/new-organization`, { headers: { cookie: createCookie } })).text();
  assert.match(createHtml, /An organization with this name already exists\./);
  assert.doesNotMatch(createHtml, /23505|Duplicate organization name/);

  const editResponse = await fetch(`${baseUrl}/edit-organization/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'GreenHarvest Growers',
      description: 'Updated description.',
      contactEmail: 'updated@example.com',
      logoFilename: 'updated.png',
    }),
    redirect: 'manual',
  });
  assert.equal(editResponse.status, 302);
  assert.equal(editResponse.headers.get('location'), '/edit-organization/1');
  const editCookie = editResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const editHtml = await (await fetch(`${baseUrl}/edit-organization/1`, { headers: { cookie: editCookie } })).text();
  assert.match(editHtml, /An organization with this name already exists\./);
});

test('JSON body parsing accepts a valid organization submission', async () => {
  const response = await fetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'JSON Service Group',
      description: 'A valid JSON-submitted organization description.',
      contactEmail: 'json@example.com',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(lastOrganizationInsert.values[0], 'JSON Service Group');
  assert.equal(lastOrganizationInsert.values[3], 'placeholder-logo.png');
});

test('edit organization form is prepopulated and linked from the detail page', async () => {
  const response = await fetch(`${baseUrl}/edit-organization/1`);
  const html = await response.text();
  const detailResponse = await fetch(`${baseUrl}/organization/1`);
  const detailHtml = await detailResponse.text();

  assert.equal(response.status, 200);
  assert.match(html, /<input id="name" name="name"[^>]+value="BrightFuture Builders"/);
  assert.match(html, /<textarea id="description" name="description"[^>]*>A nonprofit focused on improving community infrastructure through sustainable construction projects\.<\/textarea>/);
  assert.match(html, /<input id="contactEmail" name="contactEmail"[^>]+value="info@brightfuturebuilders\.org"/);
  assert.match(html, /<input id="contactEmail" name="contactEmail" type="email" required maxlength="255"/);
  assert.match(html, /<input id="logoFilename" name="logoFilename"[^>]+required maxlength="255"[^>]+value="brightfuture-logo\.png"/);
  assert.ok(detailHtml.includes('href="/edit-organization/1">Edit Organization'));
});

test('valid organization edits update parameterized fields and flash once after redirect', async () => {
  const response = await fetch(`${baseUrl}/edit-organization/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: '  BrightFuture Updated  ',
      description: '  Updated organization description.  ',
      contactEmail: ' NewContact@Example.com ',
      logoFilename: ' updated-logo.png ',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/organization/1');
  assert.deepEqual(lastOrganizationUpdate.values, [
    1,
    'BrightFuture Updated',
    'Updated organization description.',
    'newcontact@example.com',
    'updated-logo.png',
  ]);
  assert.match(lastOrganizationUpdate.statement, /UPDATE organization/);
  assert.match(lastOrganizationUpdate.statement, /RETURNING organization_id/);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const detailUrl = `${baseUrl}${response.headers.get('location')}`;
  const detailHtml = await (await fetch(detailUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Organization updated successfully\./);
  const refreshedHtml = await (await fetch(detailUrl, { headers: { cookie } })).text();
  assert.doesNotMatch(refreshedHtml, /Organization updated successfully\./);
});

test('invalid edit submissions redirect with errors and do not update', async () => {
  const initialUpdateCount = organizationUpdateCount;
  const response = await fetch(`${baseUrl}/edit-organization/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Valid Organization',
      description: 'Valid description.',
      contactEmail: 'valid@example.com',
      logoFilename: '',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/edit-organization/1');
  assert.equal(organizationUpdateCount, initialUpdateCount);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const editHtml = await (await fetch(`${baseUrl}/edit-organization/1`, { headers: { cookie } })).text();
  assert.match(editHtml, /Logo filename is required\./);
  const overlongLogo = await fetch(`${baseUrl}/edit-organization/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Valid Organization',
      description: 'Valid description.',
      contactEmail: 'valid@example.com',
      logoFilename: 'x'.repeat(256),
    }),
    redirect: 'manual',
  });
  assert.equal(overlongLogo.status, 302);
  assert.equal(organizationUpdateCount, initialUpdateCount);
});

test('new project form lists organizations and enforces client-side field requirements', async () => {
  const response = await fetch(`${baseUrl}/new-project`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<input id="title" name="title" type="text" required maxlength="150"/);
  assert.match(html, /<textarea id="description" name="description" required maxlength="1000"/);
  assert.match(html, /<input id="location" name="location" type="text" required maxlength="200"/);
  assert.match(html, /<input id="date" name="date" type="date" required/);
  assert.match(html, /<select id="organizationId" name="organizationId" required>/);
  for (const organization of organizations) {
    assert.ok(html.includes(`<option value="${organization.organizationId}">${organization.name}</option>`));
  }
});

test('invalid project submissions flash errors and do not insert', async () => {
  const initialProjectCount = createdProjects.length;
  const response = await fetch(`${baseUrl}/new-project`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: ' x ',
      description: ' ',
      location: ' ',
      date: '2027-02-31',
      organizationId: '999',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/new-project');
  assert.equal(createdProjects.length, initialProjectCount);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const formHtml = await (await fetch(`${baseUrl}/new-project`, { headers: { cookie } })).text();
  assert.match(formHtml, /Project title must be between 3 and 150 characters\./);
  assert.match(formHtml, /Project description is required\./);
  assert.match(formHtml, /Project location is required\./);
  assert.match(formHtml, /Enter a valid project date\./);
  assert.match(formHtml, /Select an existing sponsoring organization\./);

  const overlongSubmission = await fetch(`${baseUrl}/new-project`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: 'T'.repeat(151),
      description: 'D'.repeat(1001),
      location: 'L'.repeat(201),
      date: '2027-03-05',
      organizationId: '1',
    }),
    redirect: 'manual',
  });
  assert.equal(overlongSubmission.status, 302);
  assert.equal(createdProjects.length, initialProjectCount);
});

test('valid project submission binds INSERT parameters and flashes after redirect', async () => {
  const response = await fetch(`${baseUrl}/new-project`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: '  Community Supply Drive  ',
      description: '  Collect supplies for neighborhood families.  ',
      location: '  Eastside Center  ',
      date: '2027-03-05',
      organizationId: '2',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  const createdProject = createdProjects.at(-1);
  assert.equal(response.headers.get('location'), `/project/${createdProject.projectId}`);
  assert.deepEqual(lastProjectInsert.values, [
    'Community Supply Drive',
    'Collect supplies for neighborhood families.',
    'Eastside Center',
    '2027-03-05',
    2,
  ]);
  assert.match(lastProjectInsert.statement, /INSERT INTO project/);
  assert.match(lastProjectInsert.statement, /project_date/);
  assert.doesNotMatch(lastProjectInsert.statement, /\bdate\s*,/i);
  assert.match(lastProjectInsert.statement, /RETURNING project_id/);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const projectUrl = `${baseUrl}${response.headers.get('location')}`;
  const detailHtml = await (await fetch(projectUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Service project created successfully\./);
  assert.match(detailHtml, /Community Supply Drive/);
  const refreshedHtml = await (await fetch(projectUrl, { headers: { cookie } })).text();
  assert.doesNotMatch(refreshedHtml, /Service project created successfully\./);
});

test('duplicate project title and organization pairs return friendly create/edit flashes', async () => {
  const initialProjectCount = createdProjects.length;
  const createResponse = await fetch(`${baseUrl}/new-project`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: 'Community Supply Drive',
      description: 'Duplicate project.',
      location: 'Community Center',
      date: '2027-03-20',
      organizationId: '2',
    }),
    redirect: 'manual',
  });

  assert.equal(createResponse.status, 302);
  assert.equal(createResponse.headers.get('location'), '/new-project');
  assert.equal(createdProjects.length, initialProjectCount);
  const createCookie = createResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const createHtml = await (await fetch(`${baseUrl}/new-project`, { headers: { cookie: createCookie } })).text();
  assert.match(createHtml, /A project with this title already exists for that organization\./);
  assert.doesNotMatch(createHtml, /23505|Duplicate project title/);

  const editResponse = await fetch(`${baseUrl}/edit-project/4`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: 'Park Cleanup',
      description: 'Conflicting project title.',
      location: 'Riverside Park',
      date: '2027-03-21',
      organizationId: '3',
    }),
    redirect: 'manual',
  });
  assert.equal(editResponse.status, 302);
  assert.equal(editResponse.headers.get('location'), '/edit-project/4');
  const editCookie = editResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const editHtml = await (await fetch(`${baseUrl}/edit-project/4`, { headers: { cookie: editCookie } })).text();
  assert.match(editHtml, /A project with this title already exists for that organization\./);
});

test('edit project form is prepopulated with ISO date and current organization', async () => {
  const response = await fetch(`${baseUrl}/edit-project/1`);
  const html = await response.text();
  const detailHtml = await (await fetch(`${baseUrl}/project/1`)).text();

  assert.equal(response.status, 200);
  assert.match(html, /<input id="title" name="title"[^>]+value="Park Cleanup"/);
  assert.match(html, /<textarea id="description" name="description"[^>]*>Join us to clean up local parks and make them beautiful!<\/textarea>/);
  assert.match(html, /<input id="location" name="location"[^>]+value="Riverside Park"/);
  assert.match(html, /<input id="date" name="date" type="date" required value="2026-12-07"/);
  assert.match(html, /<option value="3" selected>UnityServe Volunteers<\/option>/);
  assert.ok(detailHtml.includes('href="/edit-project/1">Edit Project'));
  assert.ok(detailHtml.includes('href="/assign-categories/1">Edit Categories'));
});

test('valid project edits update fields and preserve existing category assignments', async () => {
  const initialAssignments = mockedProjectCategoryAssociations
    .filter(([projectId]) => projectId === 1)
    .map(([, categoryId]) => categoryId);
  const response = await fetch(`${baseUrl}/edit-project/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: '  Updated Park Cleanup  ',
      description: '  Updated project description.  ',
      location: '  New Park  ',
      date: '2027-03-15',
      organizationId: '1',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/project/1');
  assert.deepEqual(lastProjectUpdate.values, [
    1,
    'Updated Park Cleanup',
    'Updated project description.',
    'New Park',
    '2027-03-15',
    1,
  ]);
  assert.match(lastProjectUpdate.statement, /UPDATE project/);
  assert.match(lastProjectUpdate.statement, /project_date = \$5/);
  assert.match(lastProjectUpdate.statement, /organization_id = \$6/);
  assert.match(lastProjectUpdate.statement, /RETURNING project_id/);
  assert.deepEqual(mockedProjectCategoryAssociations
    .filter(([projectId]) => projectId === 1)
    .map(([, categoryId]) => categoryId), initialAssignments);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const projectUrl = `${baseUrl}/project/1`;
  assert.match(await (await fetch(projectUrl, { headers: { cookie } })).text(), /Service project updated successfully\./);
  assert.doesNotMatch(await (await fetch(projectUrl, { headers: { cookie } })).text(), /Service project updated successfully\./);
});

test('invalid project edits redirect without updating', async () => {
  const initialUpdateCount = projectUpdateCount;
  const response = await fetch(`${baseUrl}/edit-project/1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      title: 'x',
      description: 'Description.',
      location: 'Location',
      date: '2027-02-31',
      organizationId: '999',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/edit-project/1');
  assert.equal(projectUpdateCount, initialUpdateCount);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await fetch(`${baseUrl}/edit-project/1`, { headers: { cookie } })).text();
  assert.match(html, /Project title must be between 3 and 150 characters\./);
  assert.match(html, /Enter a valid project date\./);
  assert.match(html, /Select an existing sponsoring organization\./);
});

test('category assignment form prechecks the project categories', async () => {
  const response = await fetch(`${baseUrl}/assign-categories/4`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Categories for <span>Community Center Access Ramp<\/span>/);
  assert.match(html, /<input type="checkbox" name="categoryIds" value="3" checked>/);
  assert.match(html, /<input type="checkbox" name="categoryIds" value="1">/);
  assert.match(html, /Update Categories/);
});

test('category assignments add, remove, deduplicate, flash once, and can be cleared', async () => {
  const response = await fetch(`${baseUrl}/assign-categories/4`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams([['categoryIds', '1'], ['categoryIds', '2'], ['categoryIds', '2']]),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/project/4');
  assert.deepEqual(mockedProjectCategoryAssociations
    .filter(([projectId]) => projectId === 4)
    .map(([, categoryId]) => categoryId), [1, 2]);
  assert.ok(transactionEvents.includes('COMMIT'));
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const projectUrl = `${baseUrl}/project/4`;
  const detailHtml = await (await fetch(projectUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Project categories updated successfully\./);
  assert.match(detailHtml, /href="\/category\/1"/);
  assert.match(detailHtml, /href="\/category\/2"/);
  assert.doesNotMatch(detailHtml, /href="\/category\/3"/);
  assert.doesNotMatch(await (await fetch(projectUrl, { headers: { cookie } })).text(), /Project categories updated successfully\./);

  const clearResponse = await fetch(`${baseUrl}/assign-categories/4`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(),
    redirect: 'manual',
  });
  assert.equal(clearResponse.status, 302);
  assert.deepEqual(mockedProjectCategoryAssociations.filter(([projectId]) => projectId === 4), []);
  await updateCategoryAssignments(4, [3]);
});

test('invalid and nonexistent category IDs are rejected before assignment transaction', async () => {
  const assignmentsBefore = mockedProjectCategoryAssociations.filter(([projectId]) => projectId === 4);
  const transactionCount = transactionEvents.length;

  for (const submittedIds of [['0'], ['999'], ['not-an-id']]) {
    const response = await fetch(`${baseUrl}/assign-categories/4`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(submittedIds.map((id) => ['categoryIds', id])),
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/assign-categories/4');
    assert.deepEqual(mockedProjectCategoryAssociations.filter(([projectId]) => projectId === 4), assignmentsBefore);
  }

  assert.equal(transactionEvents.length, transactionCount);
});

test('failed category insertion rolls back the assignment replacement', async () => {
  const assignmentsBefore = mockedProjectCategoryAssociations.filter(([projectId]) => projectId === 4);
  const eventsBefore = transactionEvents.length;
  const errorLog = mock.method(console, 'error', () => {});
  failCategoryAssignmentAt = 2;

  try {
    const response = await fetch(`${baseUrl}/assign-categories/4`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams([['categoryIds', '1'], ['categoryIds', '2']]),
      redirect: 'manual',
    });

    assert.equal(response.status, 503);
    assert.deepEqual(mockedProjectCategoryAssociations.filter(([projectId]) => projectId === 4), assignmentsBefore);
    assert.deepEqual(transactionEvents.slice(eventsBefore), ['BEGIN', 'DELETE', 'INSERT:1', 'INSERT:2', 'ROLLBACK']);
  } finally {
    failCategoryAssignmentAt = null;
    errorLog.mock.restore();
  }
});

test('transaction runner rolls back and releases its client on failure', async () => {
  const statements = [];
  let released = false;
  const transactionRunner = createTransactionRunner(async () => ({
    query: async (statement) => {
      statements.push(statement);
      if (statement === 'INSERT test failure') {
        throw new Error('Simulated transaction failure.');
      }
      return { rows: [] };
    },
    release: () => { released = true; },
  }));

  await assert.rejects(transactionRunner(async (transaction) => {
    await transaction.query('DELETE test assignments');
    await transaction.query('INSERT test failure');
  }), /Simulated transaction failure/);

  assert.deepEqual(statements, ['BEGIN', 'DELETE test assignments', 'INSERT test failure', 'ROLLBACK']);
  assert.equal(released, true);
});

test('session middleware rejects missing and weak secrets', () => {
  assert.throws(() => createSessionMiddleware({}), /SESSION_SECRET must contain at least 32 characters/);
  assert.throws(() => createSessionMiddleware({ SESSION_SECRET: 'too-short' }), /SESSION_SECRET must contain at least 32 characters/);
  assert.doesNotThrow(() => createSessionMiddleware({ SESSION_SECRET: 'x'.repeat(32), NODE_ENV: 'development' }));
});

test('unknown routes render the custom not-found page', async () => {
  const response = await fetch(`${baseUrl}/missing-page`);
  const html = await response.text();

  assert.equal(response.status, 404);
  assert.match(html, /Page <span>not found\.<\/span>/);
  assert.match(html, /href="\/">Return home/);
});

test('development requests are logged and the footer identifies development mode', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const requestLog = mock.method(console, 'info', () => {});
  process.env.NODE_ENV = 'development';

  try {
    const response = await fetch(`${baseUrl}/?source=test`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /\(Development mode\)/);
    assert.ok(requestLog.mock.calls.some((call) => call.arguments[0] === 'GET /?source=test'));
  } finally {
    requestLog.mock.restore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test('test error renders escaped debugging details only in development', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const errorLog = mock.method(console, 'error', () => {});

  try {
    process.env.NODE_ENV = 'development';
    const developmentResponse = await fetch(`${baseUrl}/test-error`);
    const developmentHtml = await developmentResponse.text();

    assert.equal(developmentResponse.status, 500);
    assert.match(developmentHtml, /&lt;script&gt;alert\(&#34;test&#34;\)&lt;\/script&gt;/);
    assert.doesNotMatch(developmentHtml, /<script>alert/);

    process.env.NODE_ENV = 'production';
    const productionResponse = await fetch(`${baseUrl}/test-error`);
    const productionHtml = await productionResponse.text();

    assert.equal(productionResponse.status, 500);
    assert.match(productionHtml, /Something went <span>wrong\.<\/span>/);
    assert.doesNotMatch(productionHtml, /Intentional test error|alert\(|at testErrorPage/);
    assert.doesNotMatch(productionHtml, /Development mode/);
  } finally {
    errorLog.mock.restore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test('organizations page renders database organization names, descriptions, contacts, and logos', async () => {
  const response = await fetch(`${baseUrl}/organizations`);
  const html = await response.text();

  assert.match(html, /Here are a few of our partner organizations:/);
  assert.match(html, /<h1>Partner <span>Organizations<\/span><\/h1>/);
  assert.equal((html.match(/class="organization-card"/g) ?? []).length, 3);
  assert.ok(html.includes('href="/new-organization">Add an organization'));
  for (const organization of organizations) {
    assert.ok(html.includes(`<h2><a href="/organization/${organization.organizationId}">${organization.name}</a></h2>`));
    assert.ok(html.includes(organization.description));
    assert.match(html, new RegExp(`<a href="mailto:${organization.contactEmail}">${organization.contactEmail}<\\/a>`));
    assert.match(html, new RegExp(`src="/images/${organization.logoFilename}"`));
    assert.match(html, new RegExp(`alt="${organization.name} logo"`));
  }
});

test('all organization detail pages render their five projects and required information', async () => {
  for (const organization of organizations) {
    const response = await fetch(`${baseUrl}/organization/${organization.organizationId}`);
    const html = await response.text();
    const organizationProjects = projects.filter((project) => project.organizationId === organization.organizationId);

    assert.equal(response.status, 200);
    assert.ok(html.includes(`<h1>${organization.name}</h1>`));
    assert.ok(html.includes(`src="/images/${organization.logoFilename}"`));
    assert.ok(html.includes(organization.description));
    assert.ok(html.includes(`mailto:${organization.contactEmail}`));
    assert.equal((html.match(/class="project-row"/g) ?? []).length, 5);

    for (const project of organizationProjects) {
      assert.ok(html.includes(`<a href="/project/${project.projectId}">${project.title}</a>`));
    }
  }
});

test('projects page renders only the five upcoming projects with working detail links', async () => {
  const response = await fetch(`${baseUrl}/projects`);
  const html = await response.text();

  assert.match(html, /<h1>Upcoming Service Projects<\/h1>/);
  assert.ok(html.includes('href="/new-project">Add New Service Project'));
  assert.equal((html.match(/class="project-row"/g) ?? []).length, 5);
  for (const project of upcomingProjects) {
    assert.ok(html.includes(`<h2><a href="/project/${project.projectId}">${project.title}</a></h2>`));
    assert.ok(html.includes(project.description));
    assert.ok(html.includes(`<a href="/organization/${project.organizationId}">${project.organizationName}</a>`));
    assert.ok(html.includes(project.location));
    assert.ok(html.includes(project.projectDate));
  }
  assert.doesNotMatch(html, /Senior Center Meal Delivery/);
});

test('all project detail pages display their category tags and link to organizations', async () => {
  let renderedCategoryTagCount = 0;

  for (const project of projects) {
    const response = await fetch(`${baseUrl}/project/${project.projectId}`);
    const html = await response.text();
    const projectCategories = projectCategoryAssociations
      .filter(([projectId]) => projectId === project.projectId)
      .map(([, categoryId]) => categories.find((category) => category.categoryId === categoryId));

    assert.equal(response.status, 200);
    assert.ok(html.includes(`<h1>${project.title}</h1>`));
    assert.ok(html.includes(project.description));
    assert.ok(html.includes(project.location));
    assert.ok(html.includes(project.projectDate));
    assert.ok(html.includes(`<a href="/organization/${project.organizationId}">${project.organizationName}</a>`));
    assert.equal((html.match(/class="category-tag"/g) ?? []).length, projectCategories.length);

    for (const category of projectCategories) {
      assert.ok(html.includes(`<a class="category-tag" href="/category/${category.categoryId}">${category.name}</a>`));
      renderedCategoryTagCount += 1;
    }
  }

  assert.equal(projectCategoryAssociations.length, 25);
  assert.equal(renderedCategoryTagCount, 25);
});

test('invalid and nonexistent detail IDs return the custom not-found page', async () => {
  for (const route of ['/organization/0', '/organization/not-an-id', '/organization/999', '/edit-organization/0', '/edit-organization/not-an-id', '/edit-organization/999', '/project/1.5', '/project/999', '/edit-project/0', '/edit-project/not-an-id', '/edit-project/999', '/category/0', '/category/not-an-id', '/category/999', '/edit-category/0', '/edit-category/not-an-id', '/edit-category/999', '/assign-categories/0', '/assign-categories/not-an-id', '/assign-categories/999']) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();

    assert.equal(response.status, 404, `${route} should return 404`);
    assert.match(html, /Page <span>not found\.<\/span>/);
  }
});

test('categories page contains exactly the four required category labels', async () => {
  const response = await fetch(`${baseUrl}/categories`);
  const html = await response.text();
  const categorySection = html.match(/<section class="category-list[^\"]*"[\s\S]*?<\/section>/)?.[0] ?? '';

  assert.match(html, /<h1>Choose your <span>cause\.<\/span><\/h1>/);
  assert.deepEqual(categories.filter((category) => categorySection.includes(`<h2>${category.name}</h2>`)).map((category) => category.name), categories.map((category) => category.name));
  assert.equal((categorySection.match(/<h2>/g) ?? []).length, categories.length);
  for (const category of categories) {
    assert.ok(categorySection.includes(`href="/category/${category.categoryId}"`));
  }
  assert.equal((categorySection.match(/href="\/category\/\d+"/g) ?? []).length, categories.length);
});

test('all category detail pages list every associated project and working project links', async () => {
  for (const category of categories) {
    const response = await fetch(`${baseUrl}/category/${category.categoryId}`);
    const html = await response.text();
    const categoryProjects = projectCategoryAssociations
      .filter(([, categoryId]) => categoryId === category.categoryId)
      .map(([projectId]) => projects.find((project) => project.projectId === projectId));

    assert.equal(response.status, 200);
    assert.ok(html.includes(`<h1>${category.name}</h1>`));
    assert.equal((html.match(/class="project-row"/g) ?? []).length, categoryProjects.length);

    for (const project of categoryProjects) {
      assert.ok(html.includes(`<a href="/project/${project.projectId}">${project.title}</a>`));
      assert.ok(html.includes(project.description));
      assert.ok(html.includes(project.projectDate));
    }
  }
});

test('category create and edit forms are linked, prepopulated, and have exact client-side constraints', async () => {
  const categoriesPage = await fetch(`${baseUrl}/categories`);
  const categoryListHtml = await categoriesPage.text();
  const newFormResponse = await fetch(`${baseUrl}/new-category`);
  const newFormHtml = await newFormResponse.text();
  const editFormResponse = await fetch(`${baseUrl}/edit-category/2`);
  const editFormHtml = await editFormResponse.text();
  const categoryDetailHtml = await (await fetch(`${baseUrl}/category/2`)).text();

  assert.equal(newFormResponse.status, 200);
  assert.equal(editFormResponse.status, 200);
  assert.ok(categoryListHtml.includes('href="/new-category">Add New Category'));
  assert.ok(categoryDetailHtml.includes('href="/edit-category/2">Edit Category'));
  assert.match(newFormHtml, /<input id="name" name="name" type="text" required maxlength="100"/);
  assert.match(editFormHtml, /<input id="name" name="name" type="text" required maxlength="100" value="Educational"/);
  assert.doesNotMatch(newFormHtml, /name="name"[^>]*minlength=/);
  assert.doesNotMatch(editFormHtml, /name="name"[^>]*minlength=/);
});

test('category name validation rejects empty, whitespace, short, long, and non-string values', async () => {
  const initialCategoryCount = createdCategories.length;

  for (const [name, expectedMessage] of [
    ['', 'Category name is required.'],
    ['   ', 'Category name is required.'],
    ['ab', 'Category name must be between 3 and 100 characters.'],
    ['c'.repeat(101), 'Category name must be between 3 and 100 characters.'],
  ]) {
    const response = await fetch(`${baseUrl}/new-category`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name }),
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/new-category');
    assert.equal(createdCategories.length, initialCategoryCount);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    const formHtml = await (await fetch(`${baseUrl}/new-category`, { headers: { cookie } })).text();
    assert.ok(formHtml.includes(expectedMessage));
    if (name === 'ab') {
      assert.ok(formHtml.includes('value="ab"'));
    }
  }

  const nonString = await fetch(`${baseUrl}/new-category`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: { unexpected: true } }),
    redirect: 'manual',
  });
  assert.equal(nonString.status, 302);
  assert.equal(createdCategories.length, initialCategoryCount);
});

test('category creation uses parameterized INSERT, redirects, and flashes once', async () => {
  const response = await fetch(`${baseUrl}/new-category`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: '  Community Health  ' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  const createdCategory = createdCategories.at(-1);
  assert.equal(response.headers.get('location'), `/category/${createdCategory.categoryId}`);
  assert.match(lastCategoryInsert.statement, /INSERT INTO category \(name\)/);
  assert.match(lastCategoryInsert.statement, /VALUES \(\$1\)/);
  assert.match(lastCategoryInsert.statement, /RETURNING category_id/);
  assert.deepEqual(lastCategoryInsert.values, ['Community Health']);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const detailUrl = `${baseUrl}${response.headers.get('location')}`;
  const detailHtml = await (await fetch(detailUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Category created successfully\./);
  assert.match(detailHtml, /<h1>Community Health<\/h1>/);
  assert.doesNotMatch(await (await fetch(detailUrl, { headers: { cookie } })).text(), /Category created successfully\./);
});

test('duplicate category creation is friendly and does not expose database details', async () => {
  const initialCategoryCount = createdCategories.length;
  const response = await fetch(`${baseUrl}/new-category`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Environmental' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await fetch(`${baseUrl}/new-category`, { headers: { cookie } })).text();
  assert.match(html, /A category with this name already exists\./);
  assert.doesNotMatch(html, /23505|Duplicate category name/);
  assert.equal(createdCategories.length, initialCategoryCount);
});

test('category edit updates with parameterized SQL and preserves project relationships', async () => {
  const assignmentsBefore = mockedProjectCategoryAssociations.map((assignment) => [...assignment]);
  const response = await fetch(`${baseUrl}/edit-category/3`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: '  Community Service Plus  ' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/category/3');
  assert.match(lastCategoryUpdate.statement, /UPDATE category/);
  assert.match(lastCategoryUpdate.statement, /WHERE category_id = \$1/);
  assert.match(lastCategoryUpdate.statement, /RETURNING category_id/);
  assert.deepEqual(lastCategoryUpdate.values, [3, 'Community Service Plus']);
  assert.deepEqual(mockedProjectCategoryAssociations, assignmentsBefore);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const detailHtml = await (await fetch(`${baseUrl}/category/3`, { headers: { cookie } })).text();
  assert.match(detailHtml, /Category updated successfully\./);
  assert.match(detailHtml, /<h1>Community Service Plus<\/h1>/);
  assert.doesNotMatch(await (await fetch(`${baseUrl}/category/3`, { headers: { cookie } })).text(), /Category updated successfully\./);
});

test('duplicate category edit redirects with a safe message and does not update', async () => {
  const response = await fetch(`${baseUrl}/edit-category/2`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Environmental' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/edit-category/2');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await fetch(`${baseUrl}/edit-category/2`, { headers: { cookie } })).text();
  assert.match(html, /A category with this name already exists\./);
  assert.doesNotMatch(html, /23505|Duplicate category name/);
});

test('database models select required columns and join projects to organizations', async () => {
  assert.equal(getAllOrganizations.constructor.name, 'AsyncFunction');
  assert.equal(getAllProjects.constructor.name, 'AsyncFunction');
  assert.equal(getOrganizationDetails.constructor.name, 'AsyncFunction');
  assert.equal(getProjectsByOrganizationId.constructor.name, 'AsyncFunction');
  assert.equal(getUpcomingProjects.constructor.name, 'AsyncFunction');
  assert.equal(getProjectDetails.constructor.name, 'AsyncFunction');
  assert.equal(getCategoryDetails.constructor.name, 'AsyncFunction');
  assert.equal(getCategoriesByProjectId.constructor.name, 'AsyncFunction');
  assert.equal(getProjectsByCategoryId.constructor.name, 'AsyncFunction');
  assert.equal(updateOrganization.constructor.name, 'AsyncFunction');
  assert.equal(createProject.constructor.name, 'AsyncFunction');
  assert.equal(createCategory.constructor.name, 'AsyncFunction');
  assert.equal(updateCategory.constructor.name, 'AsyncFunction');
  assert.equal(getAllCategories.constructor.name, 'AsyncFunction');

  const firstCall = queryMock.mock.calls.length;
  assert.deepEqual(await getAllOrganizations(), organizations);
  assert.deepEqual(await getAllProjects(), projects);
  assert.deepEqual(await getAllCategories(), categories);
  assert.deepEqual(await getOrganizationDetails(1), organizations[0]);
  assert.equal((await getProjectsByOrganizationId(1)).length, 5);
  assert.equal((await getUpcomingProjects(5)).length, 5);
  assert.deepEqual(await getProjectDetails(4), {
    ...projects.find((project) => project.projectId === 4),
    projectDateISO: '2026-12-05',
  });
  assert.deepEqual(await getCategoryDetails(1), categories[0]);
  assert.equal((await getCategoriesByProjectId(1)).length, 2);
  assert.equal((await getProjectsByCategoryId(1)).length, 7);
  const calls = queryMock.mock.calls.slice(firstCall);
  const statements = calls.map((call) => call.arguments[0]);

  assert.match(statements[0], /organization_id AS "organizationId"/);
  assert.match(statements[0], /contact_email AS "contactEmail"/);
  assert.match(statements[1], /INNER JOIN organization/);
  assert.match(statements[1], /organization\.name AS "organizationName"/);
  assert.match(statements[1], /TO_CHAR\(project\.project_date, 'FMMonth FMDD, YYYY'\) AS "projectDate"/);
  assert.match(statements[2], /SELECT category_id AS "categoryId"/);
  assert.match(statements[3], /WHERE organization_id = \$1/);
  assert.deepEqual(calls[3].arguments[1], [1]);
  assert.match(statements[4], /WHERE project\.organization_id = \$1/);
  assert.match(statements[4], /ORDER BY project\.project_date, project\.project_id/);
  assert.deepEqual(calls[4].arguments[1], [1]);
  assert.match(statements[5], /project\.project_date >= CURRENT_DATE/);
  assert.match(statements[5], /ORDER BY project\.project_date ASC, project\.project_id ASC/);
  assert.match(statements[5], /LIMIT \$1/);
  assert.match(statements[5], /organization\.name AS "organizationName"/);
  assert.deepEqual(calls[5].arguments[1], [5]);
  assert.match(statements[6], /project\.project_date/);
  assert.match(statements[6], /INNER JOIN organization/);
  assert.match(statements[6], /WHERE project\.project_id = \$1/);
  assert.deepEqual(calls[6].arguments[1], [4]);
  assert.match(statements[7], /WHERE category\.category_id = \$1/);
  assert.deepEqual(calls[7].arguments[1], [1]);
  assert.match(statements[8], /INNER JOIN project_category/);
  assert.match(statements[8], /WHERE project_category\.project_id = \$1/);
  assert.deepEqual(calls[8].arguments[1], [1]);
  assert.match(statements[9], /INNER JOIN project_category/);
  assert.match(statements[9], /WHERE project_category\.category_id = \$1/);
  assert.match(statements[9], /ORDER BY project\.project_date, project\.project_id/);
  assert.doesNotMatch(statements[9], /CURRENT_DATE/);
  assert.deepEqual(calls[9].arguments[1], [1]);

  const writeStart = queryMock.mock.calls.length;
  assert.equal(await updateOrganization(1, 'Updated Name', 'Updated description.', 'updated@example.com', 'updated.png'), 1);
  assert.equal(await updateOrganization(999, 'Missing Name', 'Missing description.', 'missing@example.com', 'missing.png'), null);
  const newProjectId = await createProject('Model Test Project', 'A mocked insert.', 'Test Center', '2027-03-08', 1);
  assert.ok(Number.isInteger(newProjectId));
  const writeCalls = queryMock.mock.calls.slice(writeStart);
  assert.match(writeCalls[0].arguments[0], /UPDATE organization/);
  assert.match(writeCalls[0].arguments[0], /WHERE organization_id = \$1/);
  assert.match(writeCalls[0].arguments[0], /RETURNING organization_id/);
  assert.deepEqual(writeCalls[0].arguments[1], [1, 'Updated Name', 'Updated description.', 'updated@example.com', 'updated.png']);
  assert.equal(writeCalls[1].arguments[1][0], 999);
  assert.match(writeCalls[2].arguments[0], /INSERT INTO project/);
  assert.match(writeCalls[2].arguments[0], /project_date/);
  assert.match(writeCalls[2].arguments[0], /RETURNING project_id/);
  assert.deepEqual(writeCalls[2].arguments[1], ['Model Test Project', 'A mocked insert.', 'Test Center', '2027-03-08', 1]);

  const categoryWriteStart = queryMock.mock.calls.length;
  const createdCategoryId = await createCategory('Model Test Category');
  assert.ok(Number.isInteger(createdCategoryId));
  assert.equal(await updateCategory(1, 'Model Updated Category'), 1);
  assert.equal(await updateCategory(999, 'Missing Category'), null);
  const categoryWriteCalls = queryMock.mock.calls.slice(categoryWriteStart);
  assert.match(categoryWriteCalls[0].arguments[0], /INSERT INTO category \(name\)/);
  assert.match(categoryWriteCalls[0].arguments[0], /VALUES \(\$1\)/);
  assert.match(categoryWriteCalls[0].arguments[0], /RETURNING category_id/);
  assert.deepEqual(categoryWriteCalls[0].arguments[1], ['Model Test Category']);
  assert.match(categoryWriteCalls[1].arguments[0], /UPDATE category/);
  assert.match(categoryWriteCalls[1].arguments[0], /WHERE category_id = \$1/);
  assert.match(categoryWriteCalls[1].arguments[0], /RETURNING category_id/);
  assert.deepEqual(categoryWriteCalls[1].arguments[1], [1, 'Model Updated Category']);
  assert.equal(categoryWriteCalls[2].arguments[1][0], 999);
});

test('setup SQL defines required keys, relationships, and rerunnable sample data', async () => {
  const setupSql = await readFile(new URL('../src/setup.sql', import.meta.url), 'utf8');
  const projectSeedStart = setupSql.indexOf('-- Five sample projects per organization.');
  const associationsStart = setupSql.indexOf('-- Associate every sample project');
  const projectSeedSql = setupSql.slice(projectSeedStart, associationsStart);
  const associationSql = setupSql.slice(associationsStart);

  assert.match(setupSql, /organization_id SERIAL PRIMARY KEY/);
  assert.match(setupSql, /name VARCHAR\(150\) NOT NULL UNIQUE/);
  assert.match(setupSql, /description TEXT NOT NULL/);
  assert.match(setupSql, /contact_email VARCHAR\(255\) NOT NULL/);
  assert.match(setupSql, /logo_filename VARCHAR\(255\) NOT NULL/);
  assert.match(setupSql, /project_id SERIAL PRIMARY KEY/);
  assert.match(setupSql, /organization_id INTEGER NOT NULL\s+REFERENCES organization \(organization_id\)/);
  assert.match(setupSql, /category_id SERIAL PRIMARY KEY/);
  assert.match(setupSql, /CREATE TABLE IF NOT EXISTS project_category/);
  assert.match(setupSql, /PRIMARY KEY \(project_id, category_id\)/);
  assert.match(setupSql, /REFERENCES project \(project_id\)/);
  assert.match(setupSql, /REFERENCES category \(category_id\)/);
  assert.match(setupSql, /ON CONFLICT \(organization_id, title\) DO UPDATE/);
  assert.match(setupSql, /ON CONFLICT \(project_id, category_id\) DO NOTHING/);
  assert.doesNotMatch(setupSql, /\bDROP\s+TABLE\b/i);
  assert.ok(setupSql.indexOf('CREATE TABLE IF NOT EXISTS organization') < setupSql.indexOf('CREATE TABLE IF NOT EXISTS project'));
  assert.ok(setupSql.indexOf('CREATE TABLE IF NOT EXISTS project') < setupSql.indexOf('CREATE TABLE IF NOT EXISTS project_category'));
  assert.equal((projectSeedSql.match(/DATE '\d{4}-\d{2}-\d{2}'/g) ?? []).length, 15);
  const seededProjectTitles = [
    'Community Center Access Ramp',
    'Neighborhood Playground Renewal',
    'Solar Bus Shelter Build',
    'Safe Sidewalk Repair Day',
    'Sustainable Building Workshop',
    'Community Garden Planting Day',
    'School Garden Learning Beds',
    'Harvest Box Packing',
    'Composting Basics Workshop',
    'Pollinator Garden Planting',
    'Park Cleanup',
    'Food Drive',
    'Community Tutoring',
    'Neighborhood Wellness Fair',
    'Senior Center Meal Delivery',
  ];
  for (const title of seededProjectTitles) {
    assert.ok(projectSeedSql.includes(`'${title}'`));
    assert.ok(associationSql.includes(`'${title}'`), `${title} must have a category association`);
  }
  for (const name of ['BrightFuture Builders', 'GreenHarvest Growers', 'UnityServe Volunteers']) {
    assert.equal((projectSeedSql.match(new RegExp(`'${name}',`, 'g')) ?? []).length, 5);
  }
  for (const category of categories) {
    assert.ok(setupSql.includes(`('${category.name}')`));
  }
  assert.match(setupSql, /INSERT INTO project_category/);
});

test('database pool defaults to strict TLS and strips pg-overriding sslmode parameters', () => {
  const config = createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@db.example/test?sslmode=require&application_name=cse340',
    NODE_ENV: 'development',
  });
  const parsedUrl = new URL(config.connectionString);

  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(parsedUrl.searchParams.has('sslmode'), false);
  assert.equal(parsedUrl.searchParams.get('application_name'), 'cse340');
});

test('self-signed TLS is opt-in only for production internal connections', () => {
  const config = createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@dpg-c1234567890-a/test?sslmode=require',
    NODE_ENV: 'production',
    DB_SSL_ALLOW_SELF_SIGNED_INTERNAL: 'true',
  });

  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.throws(() => createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@db.example/test',
    NODE_ENV: 'development',
    DB_SSL_ALLOW_SELF_SIGNED_INTERNAL: 'true',
  }), /only allowed in production/);
  const internalWithoutOptIn = createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@dpg-c1234567890-a/test',
    NODE_ENV: 'production',
  });
  assert.deepEqual(internalWithoutOptIn.ssl, { rejectUnauthorized: true });
  assert.throws(() => createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@external-db.oregon-postgres.render.com/test',
    NODE_ENV: 'production',
    DB_SSL_ALLOW_SELF_SIGNED_INTERNAL: 'true',
  }), /requires a Render internal PostgreSQL hostname/);
  assert.throws(() => createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@db.example/test?sslmode=disable',
    NODE_ENV: 'production',
  }), /unsupported or TLS-disabling sslmode/);
  assert.throws(() => createPoolConfig({
    DB_URL: 'postgresql://local-user:local-password@db.example/test?sslrootcert=ca.pem',
    NODE_ENV: 'production',
  }), /Remove SSL certificate options/);
});

test('testConnection safely reports a missing DB_URL', async () => {
  const originalDatabaseUrl = process.env.DB_URL;
  delete process.env.DB_URL;

  try {
    await assert.rejects(testConnection(), /DB_URL must be configured/);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DB_URL;
    } else {
      process.env.DB_URL = originalDatabaseUrl;
    }
  }
});

test('database errors return a sanitized unavailable response', async () => {
  failDatabaseQueries = true;
  const errorLog = mock.method(console, 'error', () => {});

  try {
    const response = await fetch(`${baseUrl}/organizations`);
    const body = await response.text();

    assert.equal(response.status, 503);
    assert.equal(body, 'Service data is temporarily unavailable.');
    assert.doesNotMatch(body, /Sensitive database failure detail/);
    assert.match(errorLog.mock.calls[0].arguments[0], /ECONNRESET/);
    assert.doesNotMatch(errorLog.mock.calls[0].arguments[0], /Sensitive database failure detail/);

    const detailResponse = await fetch(`${baseUrl}/organization/1`);
    assert.equal(detailResponse.status, 503);
    assert.equal(await detailResponse.text(), 'Service data is temporarily unavailable.');
  } finally {
    failDatabaseQueries = false;
    errorLog.mock.restore();
  }
});

test('database-sourced organization content is escaped by EJS', async () => {
  escapeOrganizationDescription = true;

  try {
    const response = await fetch(`${baseUrl}/organizations`);
    const html = await response.text();

    assert.match(html, /&lt;script&gt;alert/);
    assert.doesNotMatch(html, /<script>alert/);
  } finally {
    escapeOrganizationDescription = false;
  }
});

test('stylesheet and all official images are served as static files', async () => {
  const stylesheetResponse = await fetch(`${baseUrl}/css/main.css`);

  assert.equal(stylesheetResponse.status, 200);
  assert.match(stylesheetResponse.headers.get('content-type'), /text\/css/);
  assert.match(await stylesheetResponse.text(), /--green-dark/);

  for (const image of [
    'cse340-service-network.png',
    'placeholder-logo.png',
    'brightfuture-logo.png',
    'greenharvest-logo.png',
    'unityserve-logo.png',
  ]) {
    const imageResponse = await fetch(`${baseUrl}/images/${image}`);
    assert.equal(imageResponse.status, 200, `${image} should be available`);
    assert.match(imageResponse.headers.get('content-type'), /image\/png/);
  }
});
