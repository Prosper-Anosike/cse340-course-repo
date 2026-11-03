-- CSE 340 Service Network database
-- Tables are created before their dependents; seeds use conflict handling for safe reruns.

BEGIN;

CREATE TABLE IF NOT EXISTS organization (
  organization_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  logo_filename VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS category (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS project (
  project_id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL
    REFERENCES organization (organization_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  project_date DATE NOT NULL,
  CONSTRAINT project_organization_title_key UNIQUE (organization_id, title)
);

CREATE TABLE IF NOT EXISTS project_category (
  project_id INTEGER NOT NULL
    REFERENCES project (project_id) ON UPDATE CASCADE ON DELETE CASCADE,
  category_id INTEGER NOT NULL
    REFERENCES category (category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (project_id, category_id)
);

CREATE INDEX IF NOT EXISTS project_category_category_id_idx
  ON project_category (category_id);

INSERT INTO organization (name, description, contact_email, logo_filename)
VALUES
  (
    'BrightFuture Builders',
    'A nonprofit focused on improving community infrastructure through sustainable construction projects.',
    'info@brightfuturebuilders.org',
    'brightfuture-logo.png'
  ),
  (
    'GreenHarvest Growers',
    'An urban farming collective promoting food sustainability and education in local neighborhoods.',
    'contact@greenharvest.org',
    'greenharvest-logo.png'
  ),
  (
    'UnityServe Volunteers',
    'A volunteer coordination group supporting local charities and service initiatives.',
    'hello@unityserve.org',
    'unityserve-logo.png'
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  logo_filename = EXCLUDED.logo_filename;

INSERT INTO category (name)
VALUES
  ('Environmental'),
  ('Educational'),
  ('Community Service'),
  ('Health and Wellness')
ON CONFLICT (name) DO NOTHING;

-- Five sample projects per organization. The organization/title key makes this seed repeatable.
INSERT INTO project (organization_id, title, description, location, project_date)
SELECT organization.organization_id,
       project_seed.title,
       project_seed.description,
       project_seed.location,
       project_seed.project_date
FROM (VALUES
  (
    'BrightFuture Builders',
    'Community Center Access Ramp',
    'Build an accessible entrance ramp and improve entryways at a neighborhood community center.',
    'Maplewood Community Center',
    DATE '2026-12-05'
  ),
  (
    'BrightFuture Builders',
    'Neighborhood Playground Renewal',
    'Repair playground equipment and renew the safety surface with durable materials.',
    'Cedar Grove Park',
    DATE '2026-12-12'
  ),
  (
    'BrightFuture Builders',
    'Solar Bus Shelter Build',
    'Assemble a solar-lit shelter that makes a neighborhood transit stop safer and more useful.',
    'Westside Transit Plaza',
    DATE '2027-01-09'
  ),
  (
    'BrightFuture Builders',
    'Safe Sidewalk Repair Day',
    'Repair damaged sidewalk sections to improve safe access for pedestrians and mobility devices.',
    'North Park District',
    DATE '2027-01-16'
  ),
  (
    'BrightFuture Builders',
    'Sustainable Building Workshop',
    'Introduce residents to practical low-waste construction and home improvement techniques.',
    'Community Build Lab',
    DATE '2027-01-23'
  ),
  (
    'GreenHarvest Growers',
    'Community Garden Planting Day',
    'Prepare garden beds and plant seasonal vegetables for a shared neighborhood harvest.',
    'Eastside Community Garden',
    DATE '2026-12-06'
  ),
  (
    'GreenHarvest Growers',
    'School Garden Learning Beds',
    'Build and plant outdoor learning beds for local students and teachers.',
    'Lincoln Elementary School',
    DATE '2026-12-13'
  ),
  (
    'GreenHarvest Growers',
    'Harvest Box Packing',
    'Sort and pack fresh produce boxes for families in nearby neighborhoods.',
    'GreenHarvest Farm Hub',
    DATE '2027-01-10'
  ),
  (
    'GreenHarvest Growers',
    'Composting Basics Workshop',
    'Teach residents how to turn food scraps into useful compost for home and community gardens.',
    'Eastside Community Garden',
    DATE '2027-01-17'
  ),
  (
    'GreenHarvest Growers',
    'Pollinator Garden Planting',
    'Plant native flowers that support pollinators around a shared growing space.',
    'Riverside Learning Garden',
    DATE '2027-01-24'
  ),
  (
    'UnityServe Volunteers',
    'Park Cleanup',
    'Join us to clean up local parks and make them beautiful!',
    'Riverside Park',
    DATE '2026-12-07'
  ),
  (
    'UnityServe Volunteers',
    'Food Drive',
    'Help collect and distribute food to those in need.',
    'Central Community Pantry',
    DATE '2026-12-14'
  ),
  (
    'UnityServe Volunteers',
    'Community Tutoring',
    'Volunteer to tutor students in various subjects.',
    'Civic Learning Center',
    DATE '2027-01-11'
  ),
  (
    'UnityServe Volunteers',
    'Neighborhood Wellness Fair',
    'Help local providers connect residents with free wellness resources and screenings.',
    'Southside Recreation Hall',
    DATE '2027-01-18'
  ),
  (
    'UnityServe Volunteers',
    'Senior Center Meal Delivery',
    'Prepare and deliver balanced meals to neighbors served by the senior center.',
    'Unity Senior Center',
    DATE '2027-01-25'
  )
) AS project_seed (organization_name, title, description, location, project_date)
JOIN organization ON organization.name = project_seed.organization_name
ON CONFLICT (organization_id, title) DO UPDATE SET
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  project_date = EXCLUDED.project_date;

-- Associate every sample project with one or more seeded categories.
INSERT INTO project_category (project_id, category_id)
SELECT project.project_id, category.category_id
FROM (VALUES
  ('BrightFuture Builders', 'Community Center Access Ramp', 'Community Service'),
  ('BrightFuture Builders', 'Neighborhood Playground Renewal', 'Community Service'),
  ('BrightFuture Builders', 'Solar Bus Shelter Build', 'Environmental'),
  ('BrightFuture Builders', 'Solar Bus Shelter Build', 'Community Service'),
  ('BrightFuture Builders', 'Safe Sidewalk Repair Day', 'Community Service'),
  ('BrightFuture Builders', 'Sustainable Building Workshop', 'Environmental'),
  ('BrightFuture Builders', 'Sustainable Building Workshop', 'Educational'),
  ('GreenHarvest Growers', 'Community Garden Planting Day', 'Environmental'),
  ('GreenHarvest Growers', 'Community Garden Planting Day', 'Community Service'),
  ('GreenHarvest Growers', 'School Garden Learning Beds', 'Environmental'),
  ('GreenHarvest Growers', 'School Garden Learning Beds', 'Educational'),
  ('GreenHarvest Growers', 'Harvest Box Packing', 'Community Service'),
  ('GreenHarvest Growers', 'Composting Basics Workshop', 'Environmental'),
  ('GreenHarvest Growers', 'Composting Basics Workshop', 'Educational'),
  ('GreenHarvest Growers', 'Pollinator Garden Planting', 'Environmental'),
  ('GreenHarvest Growers', 'Pollinator Garden Planting', 'Educational'),
  ('UnityServe Volunteers', 'Park Cleanup', 'Environmental'),
  ('UnityServe Volunteers', 'Park Cleanup', 'Community Service'),
  ('UnityServe Volunteers', 'Food Drive', 'Community Service'),
  ('UnityServe Volunteers', 'Food Drive', 'Health and Wellness'),
  ('UnityServe Volunteers', 'Community Tutoring', 'Educational'),
  ('UnityServe Volunteers', 'Neighborhood Wellness Fair', 'Health and Wellness'),
  ('UnityServe Volunteers', 'Neighborhood Wellness Fair', 'Community Service'),
  ('UnityServe Volunteers', 'Senior Center Meal Delivery', 'Health and Wellness'),
  ('UnityServe Volunteers', 'Senior Center Meal Delivery', 'Community Service')
) AS project_category_seed (organization_name, project_title, category_name)
JOIN organization ON organization.name = project_category_seed.organization_name
JOIN project ON project.organization_id = organization.organization_id
            AND project.title = project_category_seed.project_title
JOIN category ON category.name = project_category_seed.category_name
ON CONFLICT (project_id, category_id) DO NOTHING;

COMMIT;