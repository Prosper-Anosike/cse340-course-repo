import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, mock, test } from 'node:test';
import { createPoolConfig, createTransactionRunner, database, testConnection } from '../src/models/db.js';
import { createCategory, getAllCategories, getCategoriesByProjectId, getCategoryDetails, updateCategory, updateCategoryAssignments } from '../src/models/categories.js';
import { createOrganization, getAllOrganizations, getOrganizationDetails, updateOrganization } from '../src/models/organizations.js';
import {
  addVolunteerToProject,
  createProject,
  getAllProjects,
  getProjectDetails,
  getProjectsByCategoryId,
  getProjectsVolunteeredByUser,
  getProjectsByOrganizationId,
  getUpcomingProjects,
  isUserVolunteeringForProject,
  removeVolunteerFromProject,
  updateProject,
} from '../src/models/projects.js';
import { authenticateUser, createUser, findUserByEmail, getAllUsers, verifyPassword } from '../src/models/users.js';
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
let adminCookie;
let queryMock;
let transactionMock;
let failDatabaseQueries = false;
let escapeOrganizationDescription = false;
let returnEmptyUserList = false;
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
const createdUsers = [];
let lastUserInsert;

const adminFetch = async (url, options = {}) => {
  const headers = new Headers(options.headers);
  if (!headers.has('cookie') && adminCookie) {
    headers.set('cookie', adminCookie);
  }

  return fetch(url, { ...options, headers });
};

const roles = [
  { roleId: 1, roleName: 'user', roleDescription: 'Standard user with basic access' },
  { roleId: 2, roleName: 'admin', roleDescription: 'Administrator with full system access' },
];

const existingPasswordHash = await bcrypt.hash('correct-password', 10);
const adminPasswordHash = await bcrypt.hash('admin-password', 10);

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

const users = [
  {
    userId: 1,
    name: 'Existing User',
    email: 'existing@example.com',
    passwordHash: existingPasswordHash,
    roleId: 1,
  },
  {
    userId: 2,
    name: 'Site Administrator',
    email: 'admin@example.com',
    passwordHash: adminPasswordHash,
    roleId: 2,
  },
];

const projectCategoryAssociations = [
  [4, 3], [6, 3], [8, 1], [8, 3], [10, 3], [13, 1], [13, 2],
  [5, 1], [5, 3], [7, 1], [7, 2], [9, 3], [11, 1], [11, 2], [14, 1], [14, 2],
  [1, 1], [1, 3], [2, 3], [2, 4], [3, 2], [12, 4], [12, 3], [15, 4], [15, 3],
];

let mockedProjectCategoryAssociations = projectCategoryAssociations.map((association) => [...association]);
let mockedVolunteerAssociations = [[1, 4], [1, 15]];

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

  if (normalizedStatement.includes('insert into project')
      && !normalizedStatement.includes('project_volunteer')) {
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

  if (normalizedStatement.includes('insert into users')) {
    lastUserInsert = { statement, values };

    if ([...users, ...createdUsers].some((user) => user.email === values[1])) {
      const error = new Error('Duplicate user email.');
      error.code = '23505';
      throw error;
    }

    if (!normalizedStatement.includes("where roles.role_name = 'user'")) {
      throw new Error('User creation query must assign the standard user role.');
    }

    const userRole = roles.find((role) => role.roleName === 'user');
    const user = {
      userId: users.length + createdUsers.length + 1,
      name: values[0],
      email: values[1],
      passwordHash: values[2],
      roleId: userRole?.roleId ?? null,
    };

    createdUsers.push(user);
    return { rows: user.roleId ? [{ userId: user.userId }] : [] };
  }

  if (normalizedStatement.includes('from users')
      && normalizedStatement.includes('inner join roles')
      && !normalizedStatement.includes('where users.email = $1')) {
    if (returnEmptyUserList) {
      return { rows: [] };
    }

    const userRows = [...users, ...createdUsers]
      .map((user) => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        roleName: roles.find((role) => role.roleId === user.roleId)?.roleName,
      }))
      .filter((user) => user.roleName)
      .sort((firstUser, secondUser) => firstUser.name.localeCompare(secondUser.name)
        || firstUser.userId - secondUser.userId);
    return { rows: userRows };
  }

  if (normalizedStatement.includes('from users') && normalizedStatement.includes('where users.email = $1')) {
    const user = [...users, ...createdUsers].find((record) => record.email === values[0]);

    if (!user) {
      return { rows: [] };
    }

    const role = roles.find((record) => record.roleId === user.roleId);
    return {
      rows: [{
        userId: user.userId,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        roleId: user.roleId,
        roleName: role?.roleName,
        roleDescription: role?.roleDescription,
      }],
    };
  }

  if (normalizedStatement.includes('insert into project_volunteer')) {
    const [userId, projectId] = values;
    if (mockedVolunteerAssociations.some(([existingUserId, existingProjectId]) => (
      existingUserId === userId && existingProjectId === projectId
    ))) {
      return { rows: [] };
    }
    mockedVolunteerAssociations.push([userId, projectId]);
    return { rows: [{ userId }] };
  }

  if (normalizedStatement.includes('delete from project_volunteer')) {
    const [userId, projectId] = values;
    const existingIndex = mockedVolunteerAssociations.findIndex(([existingUserId, existingProjectId]) => (
      existingUserId === userId && existingProjectId === projectId
    ));
    if (existingIndex === -1) {
      return { rows: [] };
    }
    mockedVolunteerAssociations.splice(existingIndex, 1);
    return { rows: [{ userId }] };
  }

  if (normalizedStatement.includes('select exists')
      && normalizedStatement.includes('from project_volunteer')) {
    const [userId, projectId] = values;
    const isVolunteering = mockedVolunteerAssociations.some(([existingUserId, existingProjectId]) => (
      existingUserId === userId && existingProjectId === projectId
    ));
    return { rows: [{ isVolunteering }] };
  }

  if (normalizedStatement.includes('from project_volunteer')
      && normalizedStatement.includes('inner join project')) {
    const [userId] = values;
    const volunteeredProjectIds = new Set(mockedVolunteerAssociations
      .filter(([existingUserId]) => existingUserId === userId)
      .map(([, projectId]) => projectId));
    const volunteeredProjects = projects
      .filter((project) => volunteeredProjectIds.has(project.projectId))
      .sort((firstProject, secondProject) => (
        Date.parse(firstProject.projectDate) - Date.parse(secondProject.projectDate)
        || firstProject.projectId - secondProject.projectId
      ))
      .map((project) => ({
        projectId: project.projectId,
        title: project.title,
        projectDate: project.projectDate,
        location: project.location,
        organizationName: project.organizationName,
      }));
    return { rows: volunteeredProjects };
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

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'admin@example.com', password: 'admin-password' }),
    redirect: 'manual',
  });
  assert.equal(loginResponse.status, 302);
  adminCookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(adminCookie);
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
  ['/register', 'Register'],
  ['/login', 'Log In'],
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
    assert.match(html, /href="\/register"/);
    assert.match(html, /href="\/login"/);
    assert.doesNotMatch(html, /href="\/logout"/);
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
  assert.doesNotMatch(html, /href="\/dashboard"/);
});

test('login form has labeled required email and password inputs', async () => {
  const response = await fetch(`${baseUrl}/login`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<form[^>]+action="\/login"[^>]+method="post"/);
  assert.match(html, /<label for="email">Email<\/label>/);
  assert.match(html, /<input id="email" name="email" type="email" required/);
  assert.match(html, /<label for="password">Password<\/label>/);
  assert.match(html, /<input id="password" name="password" type="password" required/);
});

test('user lookup is parameterized and authentication only returns safe user fields', async () => {
  const user = await findUserByEmail('existing@example.com');
  assert.match(queryMock.mock.calls.at(-1).arguments[0], /WHERE users\.email = \$1/);
  assert.deepEqual(queryMock.mock.calls.at(-1).arguments[1], ['existing@example.com']);
  assert.equal(user.passwordHash, existingPasswordHash);

  assert.equal(await verifyPassword('correct-password', existingPasswordHash), true);
  assert.equal(await verifyPassword('incorrect-password', existingPasswordHash), false);

  const authenticatedUser = await authenticateUser('existing@example.com', 'correct-password');
  assert.deepEqual(authenticatedUser, {
    userId: 1,
    name: 'Existing User',
    email: 'existing@example.com',
    roleId: 1,
    roleName: 'user',
    roleDescription: 'Standard user with basic access',
  });
  assert.equal(Object.hasOwn(authenticatedUser, 'passwordHash'), false);
  assert.equal(await authenticateUser('existing@example.com', 'incorrect-password'), null);
  assert.equal(await authenticateUser('missing@example.com', 'correct-password'), null);
});

test('incorrect login credentials use a generic flash message and redirect', async () => {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'wrong-password' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/login');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await fetch(`${baseUrl}/login`, { headers: { cookie } })).text();
  assert.match(html, /Email or password is incorrect\./);
  assert.doesNotMatch(html, /wrong-password|passwordHash|\$2[aby]\$/);
});

test('successful login persists safe session state and grants dashboard access', async () => {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: ' Existing@Example.com ', password: 'correct-password' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/dashboard');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);
  assert.doesNotMatch(response.headers.get('set-cookie'), /passwordHash|correct-password|\$2[aby]\$/);

  const dashboardResponse = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  const dashboardHtml = await dashboardResponse.text();
  assert.equal(dashboardResponse.status, 200);
  assert.match(dashboardHtml, /Existing User/);
  assert.match(dashboardHtml, /existing@example\.com/);
  assert.match(dashboardHtml, /href="\/logout">Logout/);
  assert.doesNotMatch(dashboardHtml, /passwordHash|correct-password|\$2[aby]\$/);

  const homeHtml = await (await fetch(`${baseUrl}/`, { headers: { cookie } })).text();
  assert.match(homeHtml, /href="\/dashboard">My Dashboard/);
  assert.doesNotMatch(homeHtml, /href="\/register"|href="\/login"/);
  assert.match(dashboardHtml, /Welcome back, Existing User\./);
});

test('anonymous dashboard access redirects with an error flash', async () => {
  const response = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/login');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const loginHtml = await (await fetch(`${baseUrl}/login`, { headers: { cookie } })).text();
  assert.match(loginHtml, /Please log in to access this page\./);
});

test('logout invalidates the session, clears its cookie, and confirms logout', async () => {
  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const cookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0];

  const logoutResponse = await fetch(`${baseUrl}/logout`, {
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(logoutResponse.status, 302);
  assert.equal(logoutResponse.headers.get('location'), '/login?loggedOut=1');
  assert.match(logoutResponse.headers.get('set-cookie'), /connect\.sid=;/);

  const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(dashboardResponse.status, 302);
  assert.equal(dashboardResponse.headers.get('location'), '/login');

  const loginHtml = await (await fetch(`${baseUrl}/login?loggedOut=1`)).text();
  assert.match(loginHtml, /You have been logged out successfully\./);
  assert.match(loginHtml, /href="\/register"/);
  assert.match(loginHtml, /href="\/login"/);
  assert.doesNotMatch(loginHtml, /href="\/logout"|passwordHash|\$2[aby]\$/);
});

test('anonymous and regular users are denied every administrative route before writes', async () => {
  const administrativeRoutes = [
    '/new-organization',
    '/edit-organization/1',
    '/new-project',
    '/edit-project/1',
    '/new-category',
    '/edit-category/1',
    '/assign-categories/1',
  ];
  const writeCount = () => queryMock.mock.calls.filter((call) => (
    /^\s*(INSERT|UPDATE|DELETE)\b/i.test(call.arguments[0])
  )).length;
  const initialWriteCount = writeCount();
  const initialTransactionCount = transactionEvents.length;

  let anonymousFlashCookie;
  for (const route of administrativeRoutes) {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${baseUrl}${route}?role=admin`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {},
        body: method === 'POST' ? new URLSearchParams({ role: 'admin' }) : undefined,
        redirect: 'manual',
      });
      assert.equal(response.status, 302, `anonymous ${method} ${route} should redirect`);
      assert.equal(response.headers.get('location'), '/login');
      anonymousFlashCookie ??= response.headers.get('set-cookie')?.split(';', 1)[0];
    }
  }

  const anonymousLoginHtml = await (await fetch(`${baseUrl}/login`, {
    headers: { cookie: anonymousFlashCookie },
  })).text();
  assert.match(anonymousLoginHtml, /Please log in to access this page\./);

  const regularLoginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  assert.equal(regularLoginResponse.status, 302);
  const regularCookie = regularLoginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(regularCookie);

  for (const route of administrativeRoutes) {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${baseUrl}${route}?role=admin`, {
        method,
        headers: {
          cookie: regularCookie,
          ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: method === 'POST' ? new URLSearchParams({ role: 'admin' }) : undefined,
        redirect: 'manual',
      });
      assert.equal(response.status, 302, `regular-user ${method} ${route} should redirect`);
      assert.equal(response.headers.get('location'), '/dashboard');
    }
  }

  const regularDashboardHtml = await (await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie: regularCookie },
  })).text();
  assert.match(regularDashboardHtml, /You do not have permission to access that page\./);
  assert.equal(writeCount(), initialWriteCount);
  assert.equal(transactionEvents.length, initialTransactionCount);
});

test('administrators can load every administrative form', async () => {
  for (const route of [
    '/new-organization',
    '/edit-organization/1',
    '/new-project',
    '/edit-project/1',
    '/new-category',
    '/edit-category/1',
    '/assign-categories/1',
  ]) {
    const response = await adminFetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, `administrator GET ${route} should be allowed`);
  }
});

test('administrative links are hidden from anonymous and regular users but visible to admins', async () => {
  const publicPages = [
    ['/organizations', ['/new-organization']],
    ['/organization/1', ['/edit-organization/1']],
    ['/projects', ['/new-project']],
    ['/project/1', ['/edit-project/1', '/assign-categories/1']],
    ['/categories', ['/new-category']],
    ['/category/1', ['/edit-category/1']],
  ];
  const restrictedLink = /href="\/(?:new-organization|edit-organization\/\d+|new-project|edit-project\/\d+|new-category|edit-category\/\d+|assign-categories\/\d+)"/;
  const regularLoginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLoginResponse.headers.get('set-cookie')?.split(';', 1)[0];

  for (const [route, adminLinks] of publicPages) {
    const anonymousResponse = await fetch(`${baseUrl}${route}`);
    const anonymousHtml = await anonymousResponse.text();
    assert.equal(anonymousResponse.status, 200, `${route} remains public`);
    assert.doesNotMatch(anonymousHtml, restrictedLink);

    const regularResponse = await fetch(`${baseUrl}${route}`, { headers: { cookie: regularCookie } });
    const regularHtml = await regularResponse.text();
    assert.equal(regularResponse.status, 200, `${route} remains public for regular users`);
    assert.doesNotMatch(regularHtml, restrictedLink);

    const adminHtml = await (await adminFetch(`${baseUrl}${route}`)).text();
    for (const link of adminLinks) {
      assert.ok(adminHtml.includes(`href="${link}"`), `${route} should show ${link} to admins`);
    }
  }
});

test('registered users page is admin-only and never returns or renders password hashes', async () => {
  const anonymousResponse = await fetch(`${baseUrl}/users?direct=1`, { redirect: 'manual' });
  assert.equal(anonymousResponse.status, 302);
  assert.equal(anonymousResponse.headers.get('location'), '/login');
  const anonymousCookie = anonymousResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const anonymousLoginHtml = await (await fetch(`${baseUrl}/login`, {
    headers: { cookie: anonymousCookie },
  })).text();
  assert.match(anonymousLoginHtml, /Please log in to access this page\./);

  const regularLoginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLoginResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const regularResponse = await fetch(`${baseUrl}/users`, {
    headers: { cookie: regularCookie },
    redirect: 'manual',
  });
  assert.equal(regularResponse.status, 302);
  assert.equal(regularResponse.headers.get('location'), '/dashboard');
  const regularDashboardHtml = await (await fetch(`${baseUrl}/dashboard`, {
    headers: { cookie: regularCookie },
  })).text();
  assert.match(regularDashboardHtml, /You do not have permission to access that page\./);
  assert.doesNotMatch(regularDashboardHtml, /href="\/users">View Registered Users/);

  const adminDashboardHtml = await (await adminFetch(`${baseUrl}/dashboard`)).text();
  assert.match(adminDashboardHtml, /href="\/users">View Registered Users/);

  const response = await adminFetch(`${baseUrl}/users`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<h1>Registered <span>Users<\/span><\/h1>/);
  assert.match(html, /Site Administrator/);
  assert.match(html, /admin@example\.com/);
  assert.match(html, />admin</);
  assert.match(html, /Existing User/);
  assert.match(html, /existing@example\.com/);
  assert.match(html, />user</);
  assert.doesNotMatch(html, /password_hash|passwordHash|\$2[aby]\$/i);
  assert.equal(html.includes(existingPasswordHash), false);
  assert.equal(html.includes(adminPasswordHash), false);
  assert.doesNotMatch(queryMock.mock.calls.at(-1).arguments[0], /password_hash/i);
});

test('users page renders its empty state when no accounts are returned', async () => {
  returnEmptyUserList = true;
  try {
    const response = await adminFetch(`${baseUrl}/users`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /No registered users yet\./);
    assert.doesNotMatch(html, /<tbody>/);
  } finally {
    returnEmptyUserList = false;
  }
});

test('registration form exposes accessible client-side constraints', async () => {
  const response = await fetch(`${baseUrl}/register`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<form[^>]+action="\/register"[^>]+method="post"/);
  assert.match(html, /<label for="name">Name<\/label>/);
  assert.match(html, /<input id="name" name="name" type="text" required maxlength="100"/);
  assert.match(html, /<label for="email">Email<\/label>/);
  assert.match(html, /<input id="email" name="email" type="email" required maxlength="100"/);
  assert.match(html, /<label for="password">Password<\/label>/);
  assert.match(html, /<input id="password" name="password" type="password" required/);
});

test('registration validation rejects invalid submissions without database writes', async () => {
  const initialUserCount = createdUsers.length;
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: '', email: 'not-an-email', password: '' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/register');
  assert.equal(createdUsers.length, initialUserCount);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const formHtml = await (await fetch(`${baseUrl}/register`, { headers: { cookie } })).text();
  assert.match(formHtml, /Name is required\./);
  assert.match(formHtml, /Enter a valid email address\./);
  assert.match(formHtml, /Password is required\./);

  const overLimitResponse = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'N'.repeat(101),
      email: `${'e'.repeat(90)}@example.com`,
      password: 'cse340!',
    }),
    redirect: 'manual',
  });
  assert.equal(overLimitResponse.status, 302);
  assert.equal(createdUsers.length, initialUserCount);
  const overLimitCookie = overLimitResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const overLimitHtml = await (await fetch(`${baseUrl}/register`, { headers: { cookie: overLimitCookie } })).text();
  assert.match(overLimitHtml, /Name must be no more than 100 characters\./);
  assert.match(overLimitHtml, /Email must be no more than 100 characters\./);
});

test('valid registration hashes the password, inserts a standard user, and redirects home', async () => {
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: '  New Course User  ',
      email: ' NewUser@Example.com ',
      password: 'cse340!',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/');
  assert.match(lastUserInsert.statement, /INSERT INTO users/);
  assert.match(lastUserInsert.statement, /SELECT \$1, \$2, \$3, roles\.role_id/);
  assert.match(lastUserInsert.statement, /FROM roles/);
  assert.match(lastUserInsert.statement, /WHERE roles\.role_name = 'user'/);
  assert.match(lastUserInsert.statement, /RETURNING user_id/);
  assert.equal(lastUserInsert.values[0], 'New Course User');
  assert.equal(lastUserInsert.values[1], 'newuser@example.com');
  assert.notEqual(lastUserInsert.values[2], 'cse340!');
  assert.ok(lastUserInsert.values[2].startsWith('$2'));
  assert.equal(await bcrypt.compare('cse340!', lastUserInsert.values[2]), true);

  const createdUser = createdUsers.at(-1);
  assert.equal(createdUser.roleId, 1);

  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const homeHtml = await (await fetch(`${baseUrl}/`, { headers: { cookie } })).text();
  assert.match(homeHtml, /Registration successful\. Please log in\./);
  assert.doesNotMatch(await (await fetch(`${baseUrl}/`, { headers: { cookie } })).text(), /Registration successful\./);
});

test('duplicate registration email returns a safe flash message', async () => {
  const initialUserCount = createdUsers.length;
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: 'Duplicate User',
      email: 'existing@example.com',
      password: 'cse340!',
    }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/register');
  assert.equal(createdUsers.length, initialUserCount);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await fetch(`${baseUrl}/register`, { headers: { cookie } })).text();
  assert.match(html, /An account with this email already exists\./);
  assert.doesNotMatch(html, /23505|Duplicate user email/);
});

test('new organization form exposes accessible client-side constraints', async () => {
  const response = await adminFetch(`${baseUrl}/new-organization`);
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
  const response = await adminFetch(`${baseUrl}/new-organization`, {
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
  const formResponse = await adminFetch(`${baseUrl}/new-organization`, { headers: { cookie } });
  const formHtml = await formResponse.text();
  assert.equal(formResponse.status, 200);
  assert.match(formHtml, /class="flash-message flash-error" role="alert"/);
  assert.match(formHtml, /Organization name must be between 3 and 150 characters\./);
  assert.match(formHtml, /Organization description is required\./);
  assert.match(formHtml, /Enter a valid contact email address\./);

  const refreshedResponse = await adminFetch(`${baseUrl}/new-organization`, { headers: { cookie } });
  assert.doesNotMatch(await refreshedResponse.text(), /class="flash-message flash-error"/);

  const overLimitResponse = await adminFetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'N'.repeat(151), description: 'D'.repeat(501), contactEmail: 'valid@example.com' }),
    redirect: 'manual',
  });
  assert.equal(overLimitResponse.status, 302);
  assert.equal(createdOrganizations.length, initialInsertCount);
  const overLimitCookie = overLimitResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const overLimitHtml = await (await adminFetch(`${baseUrl}/new-organization`, { headers: { cookie: overLimitCookie } })).text();
  assert.match(overLimitHtml, /Organization name must be between 3 and 150 characters\./);
  assert.match(overLimitHtml, /Organization description must be no more than 500 characters\./);

  const overlongEmail = await adminFetch(`${baseUrl}/new-organization`, {
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
  const overlongEmailHtml = await (await adminFetch(`${baseUrl}/new-organization`, { headers: { cookie: overlongEmailCookie } })).text();
  assert.match(overlongEmailHtml, /Contact email must be no more than 255 characters\./);
});

test('valid organization form inserts normalized parameters and flashes success once', async () => {
  const response = await adminFetch(`${baseUrl}/new-organization`, {
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
  const detailsResponse = await adminFetch(`${baseUrl}${response.headers.get('location')}`, { headers: { cookie } });
  const detailsHtml = await detailsResponse.text();
  assert.equal(detailsResponse.status, 200);
  assert.match(detailsHtml, /class="flash-message flash-success" role="status"/);
  assert.match(detailsHtml, /Organization created successfully\./);

  const refreshedResponse = await adminFetch(`${baseUrl}${response.headers.get('location')}`, { headers: { cookie } });
  assert.doesNotMatch(await refreshedResponse.text(), /class="flash-message flash-success"/);
});

test('duplicate organization names return a friendly flash on create and edit', async () => {
  const initialOrganizationCount = createdOrganizations.length;
  const createResponse = await adminFetch(`${baseUrl}/new-organization`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'BrightFuture Builders', description: 'Duplicate name.', contactEmail: 'duplicate@example.com' }),
    redirect: 'manual',
  });

  assert.equal(createResponse.status, 302);
  assert.equal(createResponse.headers.get('location'), '/new-organization');
  assert.equal(createdOrganizations.length, initialOrganizationCount);
  const createCookie = createResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const createHtml = await (await adminFetch(`${baseUrl}/new-organization`, { headers: { cookie: createCookie } })).text();
  assert.match(createHtml, /An organization with this name already exists\./);
  assert.doesNotMatch(createHtml, /23505|Duplicate organization name/);

  const editResponse = await adminFetch(`${baseUrl}/edit-organization/1`, {
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
  const editHtml = await (await adminFetch(`${baseUrl}/edit-organization/1`, { headers: { cookie: editCookie } })).text();
  assert.match(editHtml, /An organization with this name already exists\./);
});

test('JSON body parsing accepts a valid organization submission', async () => {
  const response = await adminFetch(`${baseUrl}/new-organization`, {
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
  const response = await adminFetch(`${baseUrl}/edit-organization/1`);
  const html = await response.text();
  const detailResponse = await adminFetch(`${baseUrl}/organization/1`);
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
  const response = await adminFetch(`${baseUrl}/edit-organization/1`, {
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
  const detailHtml = await (await adminFetch(detailUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Organization updated successfully\./);
  const refreshedHtml = await (await adminFetch(detailUrl, { headers: { cookie } })).text();
  assert.doesNotMatch(refreshedHtml, /Organization updated successfully\./);
});

test('invalid edit submissions redirect with errors and do not update', async () => {
  const initialUpdateCount = organizationUpdateCount;
  const response = await adminFetch(`${baseUrl}/edit-organization/1`, {
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
  const editHtml = await (await adminFetch(`${baseUrl}/edit-organization/1`, { headers: { cookie } })).text();
  assert.match(editHtml, /Logo filename is required\./);
  const overlongLogo = await adminFetch(`${baseUrl}/edit-organization/1`, {
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
  const response = await adminFetch(`${baseUrl}/new-project`);
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
  const response = await adminFetch(`${baseUrl}/new-project`, {
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
  const formHtml = await (await adminFetch(`${baseUrl}/new-project`, { headers: { cookie } })).text();
  assert.match(formHtml, /Project title must be between 3 and 150 characters\./);
  assert.match(formHtml, /Project description is required\./);
  assert.match(formHtml, /Project location is required\./);
  assert.match(formHtml, /Enter a valid project date\./);
  assert.match(formHtml, /Select an existing sponsoring organization\./);

  const overlongSubmission = await adminFetch(`${baseUrl}/new-project`, {
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
  const response = await adminFetch(`${baseUrl}/new-project`, {
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
  const detailHtml = await (await adminFetch(projectUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Service project created successfully\./);
  assert.match(detailHtml, /Community Supply Drive/);
  const refreshedHtml = await (await adminFetch(projectUrl, { headers: { cookie } })).text();
  assert.doesNotMatch(refreshedHtml, /Service project created successfully\./);
});

test('duplicate project title and organization pairs return friendly create/edit flashes', async () => {
  const initialProjectCount = createdProjects.length;
  const createResponse = await adminFetch(`${baseUrl}/new-project`, {
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
  const createHtml = await (await adminFetch(`${baseUrl}/new-project`, { headers: { cookie: createCookie } })).text();
  assert.match(createHtml, /A project with this title already exists for that organization\./);
  assert.doesNotMatch(createHtml, /23505|Duplicate project title/);

  const editResponse = await adminFetch(`${baseUrl}/edit-project/4`, {
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
  const editHtml = await (await adminFetch(`${baseUrl}/edit-project/4`, { headers: { cookie: editCookie } })).text();
  assert.match(editHtml, /A project with this title already exists for that organization\./);
});

test('edit project form is prepopulated with ISO date and current organization', async () => {
  const response = await adminFetch(`${baseUrl}/edit-project/1`);
  const html = await response.text();
  const detailHtml = await (await adminFetch(`${baseUrl}/project/1`)).text();

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
  const response = await adminFetch(`${baseUrl}/edit-project/1`, {
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
  assert.match(await (await adminFetch(projectUrl, { headers: { cookie } })).text(), /Service project updated successfully\./);
  assert.doesNotMatch(await (await adminFetch(projectUrl, { headers: { cookie } })).text(), /Service project updated successfully\./);
});

test('invalid project edits redirect without updating', async () => {
  const initialUpdateCount = projectUpdateCount;
  const response = await adminFetch(`${baseUrl}/edit-project/1`, {
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
  const html = await (await adminFetch(`${baseUrl}/edit-project/1`, { headers: { cookie } })).text();
  assert.match(html, /Project title must be between 3 and 150 characters\./);
  assert.match(html, /Enter a valid project date\./);
  assert.match(html, /Select an existing sponsoring organization\./);
});

test('category assignment form prechecks the project categories', async () => {
  const response = await adminFetch(`${baseUrl}/assign-categories/4`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Categories for <span>Community Center Access Ramp<\/span>/);
  assert.match(html, /<input type="checkbox" name="categoryIds" value="3" checked>/);
  assert.match(html, /<input type="checkbox" name="categoryIds" value="1">/);
  assert.match(html, /Update Categories/);
});

test('category assignments add, remove, deduplicate, flash once, and can be cleared', async () => {
  const response = await adminFetch(`${baseUrl}/assign-categories/4`, {
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
  const detailHtml = await (await adminFetch(projectUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Project categories updated successfully\./);
  assert.match(detailHtml, /href="\/category\/1"/);
  assert.match(detailHtml, /href="\/category\/2"/);
  assert.doesNotMatch(detailHtml, /href="\/category\/3"/);
  assert.doesNotMatch(await (await adminFetch(projectUrl, { headers: { cookie } })).text(), /Project categories updated successfully\./);

  const clearResponse = await adminFetch(`${baseUrl}/assign-categories/4`, {
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
    const response = await adminFetch(`${baseUrl}/assign-categories/4`, {
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
    const response = await adminFetch(`${baseUrl}/assign-categories/4`, {
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
  const response = await adminFetch(`${baseUrl}/organizations`);
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
    const response = await adminFetch(`${baseUrl}/organization/${organization.organizationId}`);
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
  const response = await adminFetch(`${baseUrl}/projects`);
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
    const response = await adminFetch(`${baseUrl}/project/${project.projectId}`);
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

test('dashboard lists only the current user projects and refreshes after dashboard removal', async () => {
  mockedVolunteerAssociations = [[1, 4], [1, 15], [2, 1], [2, 5]];

  const regularLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLogin.headers.get('set-cookie')?.split(';', 1)[0];

  const regularDashboard = await (await fetch(`${baseUrl}/dashboard`, { headers: { cookie: regularCookie } })).text();
  assert.match(regularDashboard, /My <span>Volunteering<\/span>|My Volunteering/);
  assert.match(regularDashboard, /Community Center Access Ramp/);
  assert.match(regularDashboard, /Senior Center Meal Delivery/);
  assert.doesNotMatch(regularDashboard, /Park Cleanup|Community Garden Planting Day/);
  assert.match(regularDashboard, /href="\/project\/4"/);
  assert.match(regularDashboard, /href="\/project\/15"/);
  assert.equal((regularDashboard.match(/Remove My Volunteering/g) ?? []).length, 2);
  assert.doesNotMatch(regularDashboard, /View Registered Users/);

  const removeResponse = await fetch(`${baseUrl}/dashboard/unvolunteer/15`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2', redirect: 'https://attacker.example/' }),
    redirect: 'manual',
  });
  assert.equal(removeResponse.status, 302);
  assert.equal(removeResponse.headers.get('location'), '/dashboard');
  assert.equal(await isUserVolunteeringForProject(1, 15), false);
  assert.equal(await isUserVolunteeringForProject(2, 1), true);
  assert.equal(await isUserVolunteeringForProject(2, 5), true);

  const removalCookie = removeResponse.headers.get('set-cookie')?.split(';', 1)[0];
  const refreshedDashboard = await (await fetch(`${baseUrl}/dashboard`, { headers: { cookie: removalCookie } })).text();
  assert.doesNotMatch(refreshedDashboard, /Senior Center Meal Delivery/);
  assert.match(refreshedDashboard, /Community Center Access Ramp/);
  assert.match(refreshedDashboard, /Your volunteering has been removed\./);

  const repeatedResponse = await fetch(`${baseUrl}/dashboard/unvolunteer/15`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(repeatedResponse.status, 302);
  assert.equal(repeatedResponse.headers.get('location'), '/dashboard');

  const invalidResponse = await fetch(`${baseUrl}/dashboard/unvolunteer/not-an-id`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  assert.equal(invalidResponse.status, 302);
  assert.equal(invalidResponse.headers.get('location'), '/dashboard');

  const anonymousResponse = await fetch(`${baseUrl}/dashboard/unvolunteer/4`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  assert.equal(anonymousResponse.status, 302);
  assert.equal(anonymousResponse.headers.get('location'), '/login');

  const adminDashboard = await (await adminFetch(`${baseUrl}/dashboard`)).text();
  assert.match(adminDashboard, /View Registered Users/);

  mockedVolunteerAssociations = [[1, 4], [1, 15]];
});

test('dashboard shows a friendly empty state when there are no volunteer registrations', async () => {
  mockedVolunteerAssociations = [];

  const regularLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLogin.headers.get('set-cookie')?.split(';', 1)[0];
  const dashboardHtml = await (await fetch(`${baseUrl}/dashboard`, { headers: { cookie: regularCookie } })).text();
  assert.match(dashboardHtml, /You are not currently volunteering for any projects\./);
  assert.match(dashboardHtml, /href="\/projects">Browse service projects/);
  assert.doesNotMatch(dashboardHtml, /Remove My Volunteering/);

  mockedVolunteerAssociations = [[1, 4], [1, 15]];
});

test('project volunteering controls reflect anonymous, regular, and admin session state', async () => {
  mockedVolunteerAssociations = [[1, 4], [1, 15]];

  const anonymousHtml = await (await fetch(`${baseUrl}/project/1`)).text();
  assert.doesNotMatch(anonymousHtml, /Volunteer for This Project|Remove My Volunteering|You are volunteering/);

  const anonymousSignup = await fetch(`${baseUrl}/project/1/volunteer`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(anonymousSignup.status, 302);
  assert.equal(anonymousSignup.headers.get('location'), '/login');
  assert.equal(await isUserVolunteeringForProject(2, 1), false);

  const regularLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLogin.headers.get('set-cookie')?.split(';', 1)[0];

  const regularBeforeHtml = await (await fetch(`${baseUrl}/project/1`, { headers: { cookie: regularCookie } })).text();
  assert.match(regularBeforeHtml, /Volunteer for This Project/);
  assert.doesNotMatch(regularBeforeHtml, /You are volunteering|Remove My Volunteering/);

  const regularSignup = await fetch(`${baseUrl}/project/1/volunteer`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(regularSignup.status, 302);
  assert.equal(regularSignup.headers.get('location'), '/project/1');
  assert.equal(await isUserVolunteeringForProject(1, 1), true);

  const duplicateSignup = await fetch(`${baseUrl}/project/1/volunteer`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(duplicateSignup.status, 302);
  const duplicateCookie = duplicateSignup.headers.get('set-cookie')?.split(';', 1)[0];
  const duplicateHtml = await (await fetch(`${baseUrl}/project/1`, { headers: { cookie: duplicateCookie } })).text();
  assert.match(duplicateHtml, /You are already volunteering for this project\./);

  const regularAfterHtml = await (await fetch(`${baseUrl}/project/1`, { headers: { cookie: regularCookie } })).text();
  assert.match(regularAfterHtml, /You are volunteering for this project/);
  assert.match(regularAfterHtml, /Remove My Volunteering/);
  assert.doesNotMatch(regularAfterHtml, /Volunteer for This Project/);

  const regularRemoval = await fetch(`${baseUrl}/project/1/unvolunteer`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(regularRemoval.status, 302);
  assert.equal(await isUserVolunteeringForProject(1, 1), false);

  const repeatedRemoval = await fetch(`${baseUrl}/project/1/unvolunteer`, {
    method: 'POST',
    headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '2' }),
    redirect: 'manual',
  });
  assert.equal(repeatedRemoval.status, 302);
  const repeatedCookie = repeatedRemoval.headers.get('set-cookie')?.split(';', 1)[0];
  const repeatedHtml = await (await fetch(`${baseUrl}/project/1`, { headers: { cookie: repeatedCookie } })).text();
  assert.match(repeatedHtml, /You are not currently volunteering for this project\./);

  const adminBeforeHtml = await (await adminFetch(`${baseUrl}/project/1`)).text();
  assert.match(adminBeforeHtml, /Volunteer for This Project/);
  const adminSignup = await adminFetch(`${baseUrl}/project/1/volunteer`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ userId: '1', role: 'admin' }),
    redirect: 'manual',
  });
  assert.equal(adminSignup.status, 302);
  assert.equal(adminSignup.headers.get('location'), '/project/1');
  assert.equal(await isUserVolunteeringForProject(2, 1), true);
  assert.equal(await isUserVolunteeringForProject(1, 1), false);

  mockedVolunteerAssociations = [[1, 4], [1, 15]];
});

test('volunteer POST routes reject invalid and nonexistent projects', async () => {
  for (const route of ['/project/0/volunteer', '/project/not-an-id/unvolunteer', '/project/999/volunteer']) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ userId: '2' }),
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login');
  }

  const regularLogin = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'existing@example.com', password: 'correct-password' }),
    redirect: 'manual',
  });
  const regularCookie = regularLogin.headers.get('set-cookie')?.split(';', 1)[0];

  for (const route of ['/project/0/volunteer', '/project/not-an-id/unvolunteer', '/project/999/volunteer']) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: { cookie: regularCookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ userId: '2' }),
      redirect: 'manual',
    });

    assert.equal(response.status, 404);
  }
});

test('invalid and nonexistent detail IDs return the custom not-found page', async () => {
  for (const route of ['/organization/0', '/organization/not-an-id', '/organization/999', '/edit-organization/0', '/edit-organization/not-an-id', '/edit-organization/999', '/project/1.5', '/project/999', '/edit-project/0', '/edit-project/not-an-id', '/edit-project/999', '/category/0', '/category/not-an-id', '/category/999', '/edit-category/0', '/edit-category/not-an-id', '/edit-category/999', '/assign-categories/0', '/assign-categories/not-an-id', '/assign-categories/999']) {
    const response = await adminFetch(`${baseUrl}${route}`);
    const html = await response.text();

    assert.equal(response.status, 404, `${route} should return 404`);
    assert.match(html, /Page <span>not found\.<\/span>/);
  }
});

test('categories page contains exactly the four required category labels', async () => {
  const response = await adminFetch(`${baseUrl}/categories`);
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
    const response = await adminFetch(`${baseUrl}/category/${category.categoryId}`);
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
  const categoriesPage = await adminFetch(`${baseUrl}/categories`);
  const categoryListHtml = await categoriesPage.text();
  const newFormResponse = await adminFetch(`${baseUrl}/new-category`);
  const newFormHtml = await newFormResponse.text();
  const editFormResponse = await adminFetch(`${baseUrl}/edit-category/2`);
  const editFormHtml = await editFormResponse.text();
  const categoryDetailHtml = await (await adminFetch(`${baseUrl}/category/2`)).text();

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
    const response = await adminFetch(`${baseUrl}/new-category`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name }),
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/new-category');
    assert.equal(createdCategories.length, initialCategoryCount);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    const formHtml = await (await adminFetch(`${baseUrl}/new-category`, { headers: { cookie } })).text();
    assert.ok(formHtml.includes(expectedMessage));
    if (name === 'ab') {
      assert.ok(formHtml.includes('value="ab"'));
    }
  }

  const nonString = await adminFetch(`${baseUrl}/new-category`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: { unexpected: true } }),
    redirect: 'manual',
  });
  assert.equal(nonString.status, 302);
  assert.equal(createdCategories.length, initialCategoryCount);
});

test('category creation uses parameterized INSERT, redirects, and flashes once', async () => {
  const response = await adminFetch(`${baseUrl}/new-category`, {
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
  const detailHtml = await (await adminFetch(detailUrl, { headers: { cookie } })).text();
  assert.match(detailHtml, /Category created successfully\./);
  assert.match(detailHtml, /<h1>Community Health<\/h1>/);
  assert.doesNotMatch(await (await adminFetch(detailUrl, { headers: { cookie } })).text(), /Category created successfully\./);
});

test('duplicate category creation is friendly and does not expose database details', async () => {
  const initialCategoryCount = createdCategories.length;
  const response = await adminFetch(`${baseUrl}/new-category`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Environmental' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await adminFetch(`${baseUrl}/new-category`, { headers: { cookie } })).text();
  assert.match(html, /A category with this name already exists\./);
  assert.doesNotMatch(html, /23505|Duplicate category name/);
  assert.equal(createdCategories.length, initialCategoryCount);
});

test('category edit updates with parameterized SQL and preserves project relationships', async () => {
  const assignmentsBefore = mockedProjectCategoryAssociations.map((assignment) => [...assignment]);
  const response = await adminFetch(`${baseUrl}/edit-category/3`, {
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
  const detailHtml = await (await adminFetch(`${baseUrl}/category/3`, { headers: { cookie } })).text();
  assert.match(detailHtml, /Category updated successfully\./);
  assert.match(detailHtml, /<h1>Community Service Plus<\/h1>/);
  assert.doesNotMatch(await (await adminFetch(`${baseUrl}/category/3`, { headers: { cookie } })).text(), /Category updated successfully\./);
});

test('duplicate category edit redirects with a safe message and does not update', async () => {
  const response = await adminFetch(`${baseUrl}/edit-category/2`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: 'Environmental' }),
    redirect: 'manual',
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/edit-category/2');
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  const html = await (await adminFetch(`${baseUrl}/edit-category/2`, { headers: { cookie } })).text();
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
  assert.equal(createUser.constructor.name, 'AsyncFunction');
  assert.equal(getAllUsers.constructor.name, 'AsyncFunction');
  assert.equal(addVolunteerToProject.constructor.name, 'AsyncFunction');
  assert.equal(removeVolunteerFromProject.constructor.name, 'AsyncFunction');
  assert.equal(getProjectsVolunteeredByUser.constructor.name, 'AsyncFunction');
  assert.equal(isUserVolunteeringForProject.constructor.name, 'AsyncFunction');

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

  const listedUsers = await getAllUsers();
  const expectedUsers = [...users, ...createdUsers]
    .map((user) => ({
      userId: user.userId,
      name: user.name,
      email: user.email,
      roleName: roles.find((role) => role.roleId === user.roleId)?.roleName,
    }))
    .filter((user) => user.roleName)
    .sort((firstUser, secondUser) => firstUser.name.localeCompare(secondUser.name)
      || firstUser.userId - secondUser.userId);
  const usersQuery = queryMock.mock.calls.at(-1).arguments[0];
  assert.deepEqual(listedUsers, expectedUsers);
  assert.match(usersQuery, /FROM users[\s\S]*INNER JOIN roles/);
  assert.match(usersQuery, /ORDER BY users\.name, users\.user_id/);
  assert.match(usersQuery, /user_id AS "userId"/);
  assert.match(usersQuery, /role_name AS "roleName"/);
  assert.doesNotMatch(usersQuery, /password_hash|passwordHash|SELECT\s+\*/i);
  assert.deepEqual(Object.keys(listedUsers[0]), ['userId', 'name', 'email', 'roleName']);

  const userWriteStart = queryMock.mock.calls.length;
  const createdUserId = await createUser('Model User', 'modeluser@example.com', '$2b$10$hashedValue');
  assert.ok(Number.isInteger(createdUserId));
  const userWriteCalls = queryMock.mock.calls.slice(userWriteStart);
  assert.match(userWriteCalls[0].arguments[0], /INSERT INTO users/);
  assert.match(userWriteCalls[0].arguments[0], /SELECT \$1, \$2, \$3, roles\.role_id/);
  assert.match(userWriteCalls[0].arguments[0], /FROM roles/);
  assert.match(userWriteCalls[0].arguments[0], /WHERE roles\.role_name = 'user'/);
  assert.match(userWriteCalls[0].arguments[0], /RETURNING user_id/);
  assert.deepEqual(userWriteCalls[0].arguments[1], ['Model User', 'modeluser@example.com', '$2b$10$hashedValue']);

  const volunteerWriteStart = queryMock.mock.calls.length;
  assert.equal(await addVolunteerToProject(2, 1), true);
  assert.equal(await addVolunteerToProject(2, 1), false);
  assert.equal(await isUserVolunteeringForProject(2, 1), true);
  const volunteeredProjects = await getProjectsVolunteeredByUser(2);
  assert.equal(volunteeredProjects.length, 1);
  assert.deepEqual(volunteeredProjects[0], {
    projectId: 1,
    title: 'Park Cleanup',
    projectDate: 'December 7, 2026',
    location: 'Riverside Park',
    organizationName: 'UnityServe Volunteers',
  });
  assert.equal(await removeVolunteerFromProject(2, 999), false);
  assert.equal(await removeVolunteerFromProject(2, 1), true);
  assert.equal(await isUserVolunteeringForProject(2, 1), false);

  const volunteerCalls = queryMock.mock.calls.slice(volunteerWriteStart);
  assert.match(volunteerCalls[0].arguments[0], /INSERT INTO project_volunteer/);
  assert.match(volunteerCalls[0].arguments[0], /VALUES \(\$1, \$2\)/);
  assert.match(volunteerCalls[0].arguments[0], /ON CONFLICT \(user_id, project_id\) DO NOTHING/);
  assert.deepEqual(volunteerCalls[0].arguments[1], [2, 1]);
  assert.match(volunteerCalls[2].arguments[0], /SELECT EXISTS/);
  assert.match(volunteerCalls[2].arguments[0], /FROM project_volunteer/);
  assert.deepEqual(volunteerCalls[2].arguments[1], [2, 1]);
  assert.match(volunteerCalls[3].arguments[0], /FROM project_volunteer/);
  assert.match(volunteerCalls[3].arguments[0], /INNER JOIN project/);
  assert.match(volunteerCalls[3].arguments[0], /ORDER BY project\.project_date ASC, project\.project_id ASC/);
  assert.deepEqual(volunteerCalls[3].arguments[1], [2]);
  assert.match(volunteerCalls[4].arguments[0], /DELETE FROM project_volunteer/);
  assert.match(volunteerCalls[4].arguments[0], /WHERE user_id = \$1/);
  assert.match(volunteerCalls[4].arguments[0], /AND project_id = \$2/);
  assert.deepEqual(volunteerCalls[4].arguments[1], [2, 999]);
  assert.deepEqual(volunteerCalls[5].arguments[1], [2, 1]);
});

test('project volunteer registration is parameterized, duplicate-safe, removable, and scoped', async () => {
  mockedVolunteerAssociations = [[1, 4], [1, 15]];

  assert.equal(await addVolunteerToProject(1, 4), false);
  assert.equal(await isUserVolunteeringForProject(1, 4), true);
  assert.equal(await addVolunteerToProject(2, 5), true);
  assert.equal(await isUserVolunteeringForProject(2, 5), true);
  assert.equal(await removeVolunteerFromProject(1, 5), false);
  assert.equal(await isUserVolunteeringForProject(1, 5), false);
  assert.equal(await removeVolunteerFromProject(2, 5), true);
  assert.equal(await isUserVolunteeringForProject(2, 5), false);

  const projectsForUserOne = await getProjectsVolunteeredByUser(1);
  assert.deepEqual(projectsForUserOne.map((project) => project.projectId), [4, 15]);
  assert.equal(projectsForUserOne.every((project) => (
    project.projectId && project.title && project.projectDate && project.location && project.organizationName
  )), true);
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
  assert.match(setupSql, /CREATE TABLE IF NOT EXISTS roles/);
  assert.match(setupSql, /role_id SERIAL PRIMARY KEY/);
  assert.match(setupSql, /role_name VARCHAR\(50\) UNIQUE NOT NULL/);
  assert.match(setupSql, /role_description TEXT/);
  assert.match(setupSql, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(setupSql, /user_id SERIAL PRIMARY KEY/);
  assert.match(setupSql, /name VARCHAR\(100\) NOT NULL/);
  assert.match(setupSql, /email VARCHAR\(100\) UNIQUE NOT NULL/);
  assert.match(setupSql, /password_hash VARCHAR\(255\) NOT NULL/);
  assert.match(setupSql, /role_id INTEGER REFERENCES roles \(role_id\)/);
  assert.match(setupSql, /created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP/);
  assert.match(setupSql, /INSERT INTO roles/);
  assert.match(setupSql, /\('user', 'Standard user with basic access'\)/);
  assert.match(setupSql, /\('admin', 'Administrator with full system access'\)/);
  assert.match(setupSql, /ON CONFLICT \(role_name\) DO UPDATE SET/);
  assert.match(setupSql, /CREATE TABLE IF NOT EXISTS project_volunteer/);
  assert.match(setupSql, /user_id INTEGER NOT NULL\s+REFERENCES users \(user_id\) ON UPDATE CASCADE ON DELETE CASCADE/);
  assert.match(setupSql, /project_id INTEGER NOT NULL\s+REFERENCES project \(project_id\) ON UPDATE CASCADE ON DELETE CASCADE/);
  assert.match(setupSql, /PRIMARY KEY \(user_id, project_id\)/);
  assert.match(setupSql, /CREATE INDEX IF NOT EXISTS project_volunteer_project_id_idx/);
  assert.match(setupSql, /ON project_volunteer \(project_id\)/);
  assert.match(setupSql, /ON CONFLICT \(organization_id, title\) DO UPDATE/);
  assert.match(setupSql, /ON CONFLICT \(project_id, category_id\) DO NOTHING/);
  assert.doesNotMatch(setupSql, /\bDROP\s+TABLE\b/i);
  assert.ok(setupSql.indexOf('CREATE TABLE IF NOT EXISTS organization') < setupSql.indexOf('CREATE TABLE IF NOT EXISTS project'));
  assert.ok(setupSql.indexOf('CREATE TABLE IF NOT EXISTS project') < setupSql.indexOf('CREATE TABLE IF NOT EXISTS project_category'));
  assert.ok(setupSql.indexOf('CREATE TABLE IF NOT EXISTS roles') < setupSql.indexOf('CREATE TABLE IF NOT EXISTS users'));
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

test('additive roles/users migration is idempotent and non-destructive', async () => {
  const migrationSql = await readFile(new URL('../src/migrations/20261124_add_roles_users.sql', import.meta.url), 'utf8');

  assert.match(migrationSql, /BEGIN;/);
  assert.match(migrationSql, /COMMIT;/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS roles/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(migrationSql, /role_id INTEGER REFERENCES roles \(role_id\)/);
  assert.match(migrationSql, /INSERT INTO roles/);
  assert.match(migrationSql, /\('user', 'Standard user with basic access'\)/);
  assert.match(migrationSql, /\('admin', 'Administrator with full system access'\)/);
  assert.match(migrationSql, /ON CONFLICT \(role_name\) DO UPDATE SET/);
  assert.doesNotMatch(migrationSql, /\bDROP\s+TABLE\b/i);
});

test('additive project volunteer migration is repeatable and non-destructive', async () => {
  const migrationSql = await readFile(new URL('../src/migrations/20261126_add_project_volunteer.sql', import.meta.url), 'utf8');

  assert.match(migrationSql, /BEGIN;/);
  assert.match(migrationSql, /COMMIT;/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS project_volunteer/);
  assert.match(migrationSql, /user_id INTEGER NOT NULL\s+REFERENCES users \(user_id\) ON UPDATE CASCADE ON DELETE CASCADE/);
  assert.match(migrationSql, /project_id INTEGER NOT NULL\s+REFERENCES project \(project_id\) ON UPDATE CASCADE ON DELETE CASCADE/);
  assert.match(migrationSql, /PRIMARY KEY \(user_id, project_id\)/);
  assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS project_volunteer_project_id_idx/);
  assert.match(migrationSql, /ON project_volunteer \(project_id\)/);
  assert.doesNotMatch(migrationSql, /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
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
