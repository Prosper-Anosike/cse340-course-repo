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

export { getAllCategories };