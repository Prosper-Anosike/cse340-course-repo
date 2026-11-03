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

export { getAllOrganizations };