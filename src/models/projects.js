import { database } from './db.js';

export async function getAllProjects() {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'YYYY-MM-DD') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    ORDER BY project.project_date, project.title;
  `);

  return result.rows;
}