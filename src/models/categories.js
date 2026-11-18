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

const assignCategoryToProject = async (projectId, categoryId, transaction = database) => {
  await transaction.query(`
    INSERT INTO project_category (project_id, category_id)
    VALUES ($1, $2)
    ON CONFLICT (project_id, category_id) DO NOTHING;
  `, [projectId, categoryId]);
};

const updateCategoryAssignments = async (projectId, categoryIds) => {
  const uniqueCategoryIds = [...new Set(categoryIds)];

  await database.transaction(async (transaction) => {
    await transaction.query(`
      DELETE FROM project_category
      WHERE project_id = $1;
    `, [projectId]);

    for (const categoryId of uniqueCategoryIds) {
      await assignCategoryToProject(projectId, categoryId, transaction);
    }
  });

  return uniqueCategoryIds;
};

const createCategory = async (name) => {
  const result = await database.query(`
    INSERT INTO category (name)
    VALUES ($1)
    RETURNING category_id AS "categoryId";
  `, [name]);

  return result.rows[0]?.categoryId ?? null;
};

const updateCategory = async (categoryId, name) => {
  const result = await database.query(`
    UPDATE category
    SET name = $2
    WHERE category_id = $1
    RETURNING category_id AS "categoryId";
  `, [categoryId, name]);

  return result.rows[0]?.categoryId ?? null;
};

export { createCategory, getAllCategories, getCategoriesByProjectId, getCategoryDetails, updateCategory, updateCategoryAssignments };