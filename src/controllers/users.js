import bcrypt from 'bcrypt';
import { body, matchedData, validationResult } from 'express-validator';
import { safeDatabaseErrorCode } from '../models/db.js';
import { authenticateUser, createUser, getAllUsers } from '../models/users.js';

const SALT_ROUNDS = 10;

const registrationValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .bail()
    .isLength({ max: 100 }).withMessage('Name must be no more than 100 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .bail()
    .isLength({ max: 100 }).withMessage('Email must be no more than 100 characters.')
    .bail()
    .isEmail().withMessage('Enter a valid email address.')
    .bail()
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const showUserRegistrationForm = (_request, response) => {
  response.render('register', {
    title: 'Register',
    currentPath: '/register',
  });
};

const showLoginForm = (request, response) => {
  if (request.query.loggedOut === '1') {
    response.locals.flash ??= {};
    response.locals.flash.success = [
      ...(response.locals.flash.success ?? []),
      'You have been logged out successfully.',
    ];
  }

  response.render('login', {
    title: 'Log In',
    currentPath: '/login',
  });
};

const processLoginForm = async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  try {
    const user = email && password ? await authenticateUser(email, password) : null;

    if (!user) {
      request.flash('error', 'Email or password is incorrect.');
      return response.redirect('/login');
    }

    await new Promise((resolve, reject) => {
      request.session.regenerate((error) => error ? reject(error) : resolve());
    });

    request.session.user = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      roleDescription: user.roleDescription,
    };
    request.flash('success', `Welcome back, ${user.name}.`);

    await new Promise((resolve, reject) => {
      request.session.save((error) => error ? reject(error) : resolve());
    });

    response.redirect('/dashboard');
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'Email or password is incorrect.');
      return response.redirect('/login');
    }

    console.error(`Unable to process login (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processLogout = (request, response) => {
  request.session.destroy((error) => {
    if (error) {
      console.error('Unable to invalidate the user session.');
      return response.status(503).send('Unable to log out at this time.');
    }

    response.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    response.redirect('/login?loggedOut=1');
  });
};

const requireLogin = (request, response, next) => {
  if (!request.session.user) {
    request.flash('error', 'Please log in to access this page.');
    return response.redirect('/login');
  }

  next();
};

const requireRole = (roleName) => (request, response, next) => {
  if (!request.session.user) {
    return requireLogin(request, response, next);
  }

  if (request.session.user.roleName !== roleName) {
    request.flash('error', 'You do not have permission to access that page.');
    return response.redirect('/dashboard');
  }

  next();
};

const showDashboard = (_request, response) => {
  response.render('dashboard', {
    title: 'My Dashboard',
    currentPath: '/dashboard',
  });
};

const showUsersPage = async (_request, response) => {
  try {
    const users = await getAllUsers();
    response.render('users', {
      title: 'Registered Users',
      currentPath: '/users',
      users,
    });
  } catch (error) {
    console.error(`Unable to load registered users (${safeDatabaseErrorCode(error)}). Verify DB_URL and database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

const processUserRegistrationForm = async (request, response) => {
  const validationErrors = validationResult(request);

  if (!validationErrors.isEmpty()) {
    for (const error of validationErrors.array()) {
      request.flash('error', error.msg);
    }

    return response.redirect('/register');
  }

  const { name, email, password } = matchedData(request);

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await createUser(name, email, passwordHash);

    if (!userId) {
      throw new Error('User insert did not return an ID.');
    }

    request.flash('success', 'Registration successful. Please log in.');
    response.redirect('/');
  } catch (error) {
    if (error.code === '23505') {
      request.flash('error', 'An account with this email already exists.');
      return response.redirect('/register');
    }

    console.error(`Unable to register user (${safeDatabaseErrorCode(error)}). Verify database availability.`);
    response.status(503).send('Service data is temporarily unavailable.');
  }
};

export {
  processLoginForm,
  processLogout,
  processUserRegistrationForm,
  requireLogin,
  requireRole,
  registrationValidation,
  showDashboard,
  showLoginForm,
  showUsersPage,
  showUserRegistrationForm,
};
