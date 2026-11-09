import { database } from './db.js';

const getAllProjects = async () => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    ORDER BY project.project_date, project.title;
  `);

  return result.rows;
};

const getProjectsByOrganizationId = async (organizationId) => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    WHERE project.organization_id = $1
    ORDER BY project.project_date, project.project_id;
  `, [organizationId]);

  return result.rows;
};

const getUpcomingProjects = async (numberOfProjects) => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    WHERE project.project_date >= CURRENT_DATE
    ORDER BY project.project_date ASC, project.project_id ASC
    LIMIT $1;
  `, [numberOfProjects]);

  return result.rows;
};

const getProjectDetails = async (projectId) => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    WHERE project.project_id = $1;
  `, [projectId]);

  return result.rows[0] ?? null;
};

const getProjectsByCategoryId = async (categoryId) => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.organization_id AS "organizationId",
           project.title,
           project.description,
           project.location,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           organization.name AS "organizationName"
    FROM project
    INNER JOIN project_category
      ON project_category.project_id = project.project_id
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    WHERE project_category.category_id = $1
    ORDER BY project.project_date, project.project_id;
  `, [categoryId]);

  return result.rows;
};

export { getAllProjects, getProjectDetails, getProjectsByCategoryId, getProjectsByOrganizationId, getUpcomingProjects };