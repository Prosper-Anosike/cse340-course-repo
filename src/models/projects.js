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

const addVolunteerToProject = async (userId, projectId) => {
  const result = await database.query(`
    INSERT INTO project_volunteer (user_id, project_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, project_id) DO NOTHING
    RETURNING user_id AS "userId";
  `, [userId, projectId]);

  return Boolean(result.rows[0]?.userId);
};

const removeVolunteerFromProject = async (userId, projectId) => {
  const result = await database.query(`
    DELETE FROM project_volunteer
    WHERE user_id = $1
      AND project_id = $2
    RETURNING user_id AS "userId";
  `, [userId, projectId]);

  return Boolean(result.rows[0]?.userId);
};

const getProjectsVolunteeredByUser = async (userId) => {
  const result = await database.query(`
    SELECT project.project_id AS "projectId",
           project.title,
           TO_CHAR(project.project_date, 'FMMonth FMDD, YYYY') AS "projectDate",
           project.location,
           organization.name AS "organizationName"
    FROM project_volunteer
    INNER JOIN project
      ON project.project_id = project_volunteer.project_id
    INNER JOIN organization
      ON organization.organization_id = project.organization_id
    WHERE project_volunteer.user_id = $1
    ORDER BY project.project_date ASC, project.project_id ASC;
  `, [userId]);

  return result.rows;
};

const isUserVolunteeringForProject = async (userId, projectId) => {
  const result = await database.query(`
    SELECT EXISTS (
      SELECT 1
      FROM project_volunteer
      WHERE user_id = $1
        AND project_id = $2
    ) AS "isVolunteering";
  `, [userId, projectId]);

  return Boolean(result.rows[0]?.isVolunteering);
};

export {
  addVolunteerToProject,
  createProject,
  getAllProjects,
  getProjectDetails,
  getProjectsByCategoryId,
  getProjectsVolunteeredByUser,
  getProjectsByOrganizationId,
  getUpcomingProjects,
  isUserVolunteeringForProject,
  removeVolunteerFromProject,
  updateProject,
};