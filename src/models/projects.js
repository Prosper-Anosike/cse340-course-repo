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
           TO_CHAR(project.project_date, 'YYYY-MM-DD') AS "projectDateISO",
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

const createProject = async (title, description, location, date, organizationId) => {
  const result = await database.query(`
    INSERT INTO project (title, description, location, project_date, organization_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING project_id AS "projectId";
  `, [title, description, location, date, organizationId]);

  return result.rows[0]?.projectId ?? null;
};

const updateProject = async (projectId, title, description, location, date, organizationId) => {
  const result = await database.query(`
    UPDATE project
    SET title = $2,
        description = $3,
        location = $4,
        project_date = $5,
        organization_id = $6
    WHERE project_id = $1
    RETURNING project_id AS "projectId";
  `, [projectId, title, description, location, date, organizationId]);

  return result.rows[0]?.projectId ?? null;
};

export { createProject, getAllProjects, getProjectDetails, getProjectsByCategoryId, getProjectsByOrganizationId, getUpcomingProjects, updateProject };