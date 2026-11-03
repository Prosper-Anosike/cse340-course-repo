import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, mock, test } from 'node:test';
import app from '../src/app.js';
import { createPoolConfig, database, testConnection } from '../src/models/db.js';
import { getAllCategories } from '../src/models/categories.js';
import { getAllOrganizations } from '../src/models/organizations.js';
import { getAllProjects } from '../src/models/projects.js';

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
];

const categories = [
  { categoryId: 1, name: 'Environmental' },
  { categoryId: 2, name: 'Educational' },
  { categoryId: 3, name: 'Community Service' },
  { categoryId: 4, name: 'Health and Wellness' },
];

const mockedQuery = async (statement) => {
  if (failDatabaseQueries) {
    const error = new Error('Sensitive database failure detail must not be sent to clients.');
    error.code = 'ECONNRESET';
    throw error;
  }

  const normalizedStatement = statement.toLowerCase();

  if (normalizedStatement.includes('from project')) {
    return { rows: projects };
  }

  if (normalizedStatement.includes('from organization')) {
    const result = escapeOrganizationDescription
      ? [{ ...organizations[0], description: '<script>alert("x")</script>' }]
      : organizations;
    return { rows: result };
  }

  if (normalizedStatement.includes('from category')) {
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

test('organizations page renders database organization names, descriptions, contacts, and logos', async () => {
  const response = await fetch(`${baseUrl}/organizations`);
  const html = await response.text();

  assert.match(html, /Here are a few of our partner organizations:/);
  assert.match(html, /<h1>Partner <span>Organizations<\/span><\/h1>/);
  for (const organization of organizations) {
    assert.match(html, new RegExp(`<h2>${organization.name}<\\/h2>`));
    assert.ok(html.includes(organization.description));
    assert.match(html, new RegExp(`<a href="mailto:${organization.contactEmail}">${organization.contactEmail}<\\/a>`));
    assert.match(html, new RegExp(`src="/images/${organization.logoFilename}"`));
    assert.match(html, new RegExp(`alt="${organization.name} logo"`));
  }
});

test('projects page renders records with the sponsoring organization name', async () => {
  const response = await fetch(`${baseUrl}/projects`);
  const html = await response.text();

  assert.match(html, /<h1>Upcoming Service Projects<\/h1>/);
  for (const project of projects) {
    assert.match(html, new RegExp(`<h2>${project.title}<\\/h2>`));
    assert.ok(html.includes(project.description));
    assert.ok(html.includes(project.organizationName));
    assert.ok(html.includes(project.location));
    assert.ok(html.includes(project.projectDate));
  }
});

test('categories page contains exactly the four required category labels', async () => {
  const response = await fetch(`${baseUrl}/categories`);
  const html = await response.text();
  const categorySection = html.match(/<section class="category-list[^\"]*"[\s\S]*?<\/section>/)?.[0] ?? '';

  assert.match(html, /<h1>Choose your <span>cause\.<\/span><\/h1>/);
  assert.deepEqual(categories.map((category) => category.name).filter((name) => categorySection.includes(`<h2>${name}</h2>`)), categories.map((category) => category.name));
  assert.equal((categorySection.match(/<h2>/g) ?? []).length, categories.length);
  assert.equal((categorySection.match(/href="\/projects"/g) ?? []).length, categories.length);
  assert.equal((categorySection.match(/View all projects/g) ?? []).length, categories.length);
});

test('database models select required columns and join projects to organizations', async () => {
  assert.equal(getAllOrganizations.constructor.name, 'AsyncFunction');
  assert.equal(getAllProjects.constructor.name, 'AsyncFunction');
  assert.equal(getAllCategories.constructor.name, 'AsyncFunction');

  const firstCall = queryMock.mock.calls.length;
  assert.deepEqual(await getAllOrganizations(), organizations);
  assert.deepEqual(await getAllProjects(), projects);
  assert.deepEqual(await getAllCategories(), categories);
  const statements = queryMock.mock.calls.slice(firstCall).map((call) => call.arguments[0]);

  assert.match(statements[0], /organization_id AS "organizationId"/);
  assert.match(statements[0], /contact_email AS "contactEmail"/);
  assert.match(statements[1], /INNER JOIN organization/);
  assert.match(statements[1], /organization\.name AS "organizationName"/);
  assert.match(statements[1], /TO_CHAR\(project\.project_date, 'FMMonth FMDD, YYYY'\) AS "projectDate"/);
  assert.match(statements[2], /SELECT category_id AS "categoryId"/);
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
