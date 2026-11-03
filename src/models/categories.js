import { database } from './db.js';

export async function getAllCategories() {
  const result = await database.query(`
    SELECT category_id AS "categoryId",
           name
    FROM category
    ORDER BY name;
  `);

  return result.rows;
}