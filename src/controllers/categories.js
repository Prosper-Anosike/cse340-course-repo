import { body, matchedData, validationResult } from 'express-validator';
import { safeDatabaseErrorCode } from '../models/db.js';
import { createCategory, getAllCategories, getCategoriesByProjectId, getCategoryDetails, updateCategory, updateCategoryAssignments } from '../models/categories.js';
import { getProjectDetails, getProjectsByCategoryId } from '../models/projects.js';

const categoryValidation = [
  body('name')
    .isString().withMessage('Category name must be text.')
    .bail()
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .bail()
    .isLength({ min: 3, max: 100 }).withMessage('Category name must be between 3 and 100 characters.'),
];

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

const showAssignCategoriesForm = async (request, response) => {
  const projectId = getPositiveId(request.params.projectId);

  if (projectId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const project = await getProjectDetails(projectId);

    if (!project) {
      return showNotFoundPage(request, response);
    }

    const [categories, assignedCategories] = await Promise.all([
      getAllCategories(),
      getCategoriesByProjectId(projectId),
    ]);

    response.render('assign-categories', {
      title: 'Edit Project Categories',
      currentPath: '/projects',
      project,
      categories,
      assignedCategoryIds: assignedCategories.map((category) => category.categoryId),
    });
  } catch (error) {
    console.error(`Unable to load project categories (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processAssignCategoriesForm = async (request, response) => {
  const projectId = getPositiveId(request.params.projectId);

  if (projectId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const project = await getProjectDetails(projectId);

    if (!project) {
      return showNotFoundPage(request, response);
    }

    const submitted = request.body?.categoryIds;
    const rawCategoryIds = submitted === undefined ? [] : Array.isArray(submitted) ? submitted : [submitted];
    const categoryIds = rawCategoryIds.map((value) => {
      if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
      }

      return getPositiveId(String(value).trim());
    });

    if (categoryIds.some((categoryId) => categoryId === null)) {
      request.flash('error', 'Select valid project categories.');
      return response.redirect(`/assign-categories/${projectId}`);
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    const categories = await getAllCategories();
    const existingCategoryIds = new Set(categories.map((category) => category.categoryId));

    if (uniqueCategoryIds.some((categoryId) => !existingCategoryIds.has(categoryId))) {
      request.flash('error', 'Select only categories that exist.');
      return response.redirect(`/assign-categories/${projectId}`);
    }

    await updateCategoryAssignments(projectId, uniqueCategoryIds);
    request.flash('success', 'Project categories updated successfully.');
    response.redirect(`/project/${projectId}`);
  } catch (error) {
    console.error(`Unable to update project categories (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
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

const showNewCategoryForm = (_request, response) => {
  response.render('new-category', {
    title: 'Add a Category',
    currentPath: '/categories',
  });
};

const processNewCategoryForm = async (request, response) => {
  const validationErrors = validationResult(request);

  if (!validationErrors.isEmpty()) {
    for (const error of validationErrors.array()) {
      request.flash('error', error.msg);
    }
    request.flash('oldInput', typeof request.body.name === 'string' ? request.body.name : '');
    return response.redirect('/new-category');
  }

  const { name } = matchedData(request);

  try {
    const categoryId = await createCategory(name);

    if (!categoryId) {
      throw new Error('Category insert did not return an ID.');
    }

    request.flash('success', 'Category created successfully.');
    response.redirect(`/category/${categoryId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'A category with this name already exists.');
      request.flash('oldInput', name);
      return response.redirect('/new-category');
    }

    console.error(`Unable to create category (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const showEditCategoryForm = async (request, response) => {
  const categoryId = getPositiveId(request.params.id);

  if (categoryId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const category = await getCategoryDetails(categoryId);

    if (!category) {
      return showNotFoundPage(request, response);
    }

    response.render('edit-category', {
      title: 'Edit Category',
      currentPath: '/categories',
      category,
    });
  } catch (error) {
    console.error(`Unable to load category for editing (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processEditCategoryForm = async (request, response) => {
  const categoryId = getPositiveId(request.params.id);

  if (categoryId === null) {
    return showNotFoundPage(request, response);
  }

  try {
    const category = await getCategoryDetails(categoryId);

    if (!category) {
      return showNotFoundPage(request, response);
    }

    const validationErrors = validationResult(request);

    if (!validationErrors.isEmpty()) {
      for (const error of validationErrors.array()) {
        request.flash('error', error.msg);
      }
      request.flash('oldInput', typeof request.body.name === 'string' ? request.body.name : '');
      return response.redirect(`/edit-category/${categoryId}`);
    }

    const { name } = matchedData(request);
    const updatedCategoryId = await updateCategory(categoryId, name);

    if (!updatedCategoryId) {
      return showNotFoundPage(request, response);
    }

    request.flash('success', 'Category updated successfully.');
    response.redirect(`/category/${updatedCategoryId}`);
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'A category with this name already exists.');
      request.flash('oldInput', typeof request.body.name === 'string' ? request.body.name : '');
      return response.redirect(`/edit-category/${categoryId}`);
    }

    console.error(`Unable to update category (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

export {
  categoryValidation,
  processAssignCategoriesForm,
  processEditCategoryForm,
  processNewCategoryForm,
  showAssignCategoriesForm,
  showCategoriesPage,
  showCategoryDetailsPage,
  showEditCategoryForm,
  showNewCategoryForm,
};