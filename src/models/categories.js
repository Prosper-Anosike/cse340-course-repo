import { database } from './db.js';

const getAllCategories = async () => {
  const result = await database.query(`
    SELECT category_id AS "categoryId",
           name
    FROM category
    ORDER BY name;
  `);

  return result.rows;
};

const getCategoryDetails = async (categoryId) => {
  const result = await database.query(`
    SELECT category.category_id AS "categoryId",
           category.name
    FROM category
    WHERE category.category_id = $1;
  `, [categoryId]);

  return result.rows[0] ?? null;
};

const getCategoriesByProjectId = async (projectId) => {
  const result = await database.query(`
    SELECT category.category_id AS "categoryId",
           category.name
    FROM category
    INNER JOIN project_category
      ON project_category.category_id = category.category_id
    WHERE project_category.project_id = $1
    ORDER BY category.name;
  `, [projectId]);

  return result.rows;
};

export { getAllCategories, getCategoriesByProjectId, getCategoryDetails };