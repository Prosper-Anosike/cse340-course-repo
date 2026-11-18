import { database } from './db.js';

const getAllOrganizations = async () => {
  const result = await database.query(`
    SELECT organization_id AS "organizationId",
           name,
           description,
           contact_email AS "contactEmail",
           logo_filename AS "logoFilename"
    FROM organization
    ORDER BY name;
  `);

  return result.rows;
};

const getOrganizationDetails = async (organizationId) => {
  const result = await database.query(`
    SELECT organization_id AS "organizationId",
           name,
           description,
           contact_email AS "contactEmail",
           logo_filename AS "logoFilename"
    FROM organization
    WHERE organization_id = $1;
  `, [organizationId]);

  return result.rows[0] ?? null;
};

const createOrganization = async (name, description, contactEmail, logoFilename) => {
  const result = await database.query(`
    INSERT INTO organization (name, description, contact_email, logo_filename)
    VALUES ($1, $2, $3, $4)
    RETURNING organization_id AS "organizationId";
  `, [name, description, contactEmail, logoFilename]);

  return result.rows[0]?.organizationId ?? null;
};

const updateOrganization = async (organizationId, name, description, contactEmail, logoFilename) => {
  const result = await database.query(`
    UPDATE organization
    SET name = $2,
        description = $3,
        contact_email = $4,
        logo_filename = $5
    WHERE organization_id = $1
    RETURNING organization_id AS "organizationId";
  `, [organizationId, name, description, contactEmail, logoFilename]);

  return result.rows[0]?.organizationId ?? null;
};

export { createOrganization, getAllOrganizations, getOrganizationDetails, updateOrganization };