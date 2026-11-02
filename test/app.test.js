import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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

test('organizations page displays the official partners, emails, and logos', async () => {
  const response = await fetch(`${baseUrl}/organizations`);
  const html = await response.text();
  const organizations = [
    ['BrightFuture Builders', 'info@brightfuture.org', 'brightfuture-logo.png'],
    ['GreenHarvest Growers', 'contact@greenharvest.org', 'greenharvest-logo.png'],
    ['UnityServe Volunteers', 'hello@unityserve.org', 'unityserve-logo.png'],
  ];

  assert.match(html, /Here are a few of our partner organizations:/);
  assert.match(html, /<h1>Partner <span>Organizations<\/span><\/h1>/);
  for (const [name, email, image] of organizations) {
    assert.match(html, new RegExp(`<h2>${name}<\\/h2>`));
    assert.match(html, new RegExp(`<a href="mailto:${email}">${email}<\\/a>`));
    assert.match(html, new RegExp(`src="/images/${image}"`));
    assert.match(html, new RegExp(`alt="${name} logo"`));
  }
});

test('projects page contains the required service projects and descriptions', async () => {
  const response = await fetch(`${baseUrl}/projects`);
  const html = await response.text();

  for (const [name, description] of [
    ['Park Cleanup', 'Join us to clean up local parks and make them beautiful!'],
    ['Food Drive', 'Help collect and distribute food to those in need.'],
    ['Community Tutoring', 'Volunteer to tutor students in various subjects.'],
  ]) {
    assert.match(html, new RegExp(`<h2>${name}<\\/h2>`));
    assert.ok(html.includes(description));
  }
  assert.match(html, /<h1>Upcoming Service Projects<\/h1>/);
});

test('categories page contains exactly the four required category labels', async () => {
  const response = await fetch(`${baseUrl}/categories`);
  const html = await response.text();
  const categories = ['Environmental', 'Educational', 'Community Service', 'Health and Wellness'];
  const categorySection = html.match(/<section class="category-list[^\"]*"[\s\S]*?<\/section>/)?.[0] ?? '';

  assert.match(html, /<h1>Choose your <span>cause\.<\/span><\/h1>/);
  assert.deepEqual(categories.filter((category) => categorySection.includes(`<h2>${category}</h2>`)), categories);
  assert.equal((categorySection.match(/<h2>/g) ?? []).length, categories.length);
  assert.equal((categorySection.match(/href="\/projects"/g) ?? []).length, categories.length);
  assert.equal((categorySection.match(/View all projects/g) ?? []).length, categories.length);
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
