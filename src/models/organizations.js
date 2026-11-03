import { database } from './db.js';

export async function getAllOrganizations() {
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
}