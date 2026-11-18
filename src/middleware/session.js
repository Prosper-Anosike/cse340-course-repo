import session from 'express-session';

const SESSION_DURATION_MS = 60 * 60 * 1000;

const createSessionMiddleware = (environment = process.env) => {
  const secret = environment.SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }

  return session({
    secret,
    store: new session.MemoryStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: SESSION_DURATION_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: environment.NODE_ENV === 'production',
    },
  });
};

export { createSessionMiddleware };