import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, mock, test } from 'node:test';
import app from '../src/app.js';
import { createPoolConfig, database, testConnection } from '../src/models/db.js';
import { getAllCategories, getCategoriesByProjectId, getCategoryDetails } from '../src/models/categories.js';
import { getAllOrganizations, getOrganizationDetails } from '../src/models/organizations.js';
import { getAllProjects, getProjectDetails, getProjectsByCategoryId, getProjectsByOrganizationId, getUpcomingProjects } from '../src/models/projects.js';

let server;
let baseUrl;
let queryMock;
let failDatabaseQueries = false;
let escapeOrganizationDescription = false;

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

const mockedQuery = async (statement, values = []) => {
  if (failDatabaseQueries) {
    const error = new Error('Sensitive database failure detail must not be sent to clients.');
    error.code = 'ECONNRESET';
    throw error;
  }

  const normalizedStatement = statement.toLowerCase();

  if (normalizedStatement.includes('from project')) {
    if (normalizedStatement.includes('where project.organization_id = $1')) {
      return { rows: projects.filter((project) => project.organizationId === values[0]) };
    }

    if (normalizedStatement.includes('where project.project_id = $1')) {
      const project = projects.find((record) => record.projectId === values[0]);
      return { rows: project ? [project] : [] };
    }

    if (normalizedStatement.includes('current_date')) {
      const upcomingProjects = [...projects].sort((firstProject, secondProject) => (
        Date.parse(firstProject.projectDate) - Date.parse(secondProject.projectDate)
        || firstProject.projectId - secondProject.projectId
      ));
      return { rows: upcomingProjects.slice(0, values[0]) };
    }

    if (normalizedStatement.includes('inner join project_category')) {
      const associatedProjectIds = new Set(projectCategoryAssociations
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
      const organization = organizations.find((record) => record.organizationId === values[0]);
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
      const category = categories.find((record) => record.categoryId === values[0]);
      return { rows: category ? [category] : [] };
    }

    if (normalizedStatement.includes('inner join project_category')) {
      const associatedCategoryIds = new Set(projectCategoryAssociations
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

before(async () => {
  queryMock = mock.method(database, 'query', mockedQuery);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  queryMock.mock.restore();
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
  for (const route of ['/organization/0', '/organization/not-an-id', '/organization/999', '/project/1.5', '/project/999', '/category/0', '/category/not-an-id', '/category/999']) {
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
  assert.equal(getAllCategories.constructor.name, 'AsyncFunction');

  const firstCall = queryMock.mock.calls.length;
  assert.deepEqual(await getAllOrganizations(), organizations);
  assert.deepEqual(await getAllProjects(), projects);
  assert.deepEqual(await getAllCategories(), categories);
  assert.deepEqual(await getOrganizationDetails(1), organizations[0]);
  assert.equal((await getProjectsByOrganizationId(1)).length, 5);
  assert.equal((await getUpcomingProjects(5)).length, 5);
  assert.deepEqual(await getProjectDetails(4), projects.find((project) => project.projectId === 4));
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
    'brightfuture-logo.png',
    'greenharvest-logo.png',
    'unityserve-logo.png',
  ]) {
    const imageResponse = await fetch(`${baseUrl}/images/${image}`);
    assert.equal(imageResponse.status, 200, `${image} should be available`);
    assert.match(imageResponse.headers.get('content-type'), /image\/png/);
  }
});
