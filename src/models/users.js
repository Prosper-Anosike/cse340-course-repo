import bcrypt from 'bcrypt';
import { database } from './db.js';

const findUserByEmail = async (email) => {
  const result = await database.query(`
    SELECT users.user_id AS "userId",
           users.name,
           users.email,
           users.password_hash AS "passwordHash",
           roles.role_id AS "roleId",
           roles.role_name AS "roleName",
           roles.role_description AS "roleDescription"
    FROM users
    INNER JOIN roles
      ON roles.role_id = users.role_id
    WHERE users.email = $1;
  `, [email]);

  return result.rows[0] ?? null;
};

const getAllUsers = async () => {
  const result = await database.query(`
    SELECT users.user_id AS "userId",
           users.name,
           users.email,
           roles.role_name AS "roleName"
    FROM users
    INNER JOIN roles
      ON roles.role_id = users.role_id
    ORDER BY users.name, users.user_id;
  `);

  return result.rows;
};

const verifyPassword = async (password, passwordHash) => {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
};

const authenticateUser = async (email, password) => {
  const user = await findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  const { passwordHash, ...authenticatedUser } = user;
  return authenticatedUser;
};

const createUser = async (name, email, passwordHash) => {
  const result = await database.query(`
    INSERT INTO users (name, email, password_hash, role_id)
    SELECT $1, $2, $3, roles.role_id
    FROM roles
    WHERE roles.role_name = 'user'
    RETURNING user_id AS "userId";
  `, [name, email, passwordHash]);

  return result.rows[0]?.userId ?? null;
};

export { authenticateUser, createUser, findUserByEmail, getAllUsers, verifyPassword };
