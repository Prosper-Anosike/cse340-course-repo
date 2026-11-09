import { safeDatabaseErrorCode } from '../models/db.js';
import { getAllCategories, getCategoryDetails } from '../models/categories.js';
import { getProjectsByCategoryId } from '../models/projects.js';

const showNotFoundPage = (request, response) => response.status(404).render('errors/404', {
  title: 'Page Not Found',
  currentPath: request.path,
});

const getPositiveId = (value) => {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const showCategoriesPage = async (_request, response) => {
  try {
    const categories = await getAllCategories();
    response.render('categories', {
      title: 'Categories',
      headingStart: 'Choose your',
      headingEmphasis: 'cause.',
      currentPath: '/categories',
      categories,
    });
  } catch (error) {
    console.error(`Unable to load categories data (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showCategoryDetailsPage = async (request, response) => {
  const categoryId = getPositiveId(request.params.id);

  if (categoryId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const category = await getCategoryDetails(categoryId);

    if (!category) {
      return showNotFoundPage(request, response);
    }

    const projects = await getProjectsByCategoryId(categoryId);
    response.render('category', {
      title: category.name,
      currentPath: '/categories',
      category,
      projects,
    });
  } catch (error) {
    console.error(`Unable to load category details (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

export { showCategoriesPage, showCategoryDetailsPage };