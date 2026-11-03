import pg from 'pg';

const { Pool } = pg;
let pool;

const sslModes = new Set(['prefer', 'require', 'verify-ca', 'verify-full']);
const overridingSslParameters = new Set(['ssl', 'sslcert', 'sslkey', 'sslrootcert']);
const internalRenderPostgresHostname = /^dpg-[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export const safeDatabaseErrorCode = (error) => {
  const errorCode = typeof error?.code === 'string' ? error.code : '';
  return /^[a-z0-9_]{1,40}$/i.test(errorCode) ? errorCode : 'unknown';
};

export function createPoolConfig(environment = process.env) {
  const connectionString = environment.DB_URL?.trim();

  if (!connectionString) {
    throw new Error('DB_URL must be configured before connecting to PostgreSQL.');
  }

  const internalTlsSetting = environment.DB_SSL_ALLOW_SELF_SIGNED_INTERNAL;

  if (internalTlsSetting !== undefined && !['true', 'false'].includes(internalTlsSetting.toLowerCase())) {
    throw new Error('DB_SSL_ALLOW_SELF_SIGNED_INTERNAL must be set to true or false.');
  }

  const allowSelfSignedInternal = internalTlsSetting?.toLowerCase() === 'true';

  if (allowSelfSignedInternal && environment.NODE_ENV !== 'production') {
    throw new Error('DB_SSL_ALLOW_SELF_SIGNED_INTERNAL is only allowed in production.');
  }

  let connectionUrl;

  try {
    connectionUrl = new URL(connectionString);
  } catch {
    throw new Error('DB_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(connectionUrl.protocol)) {
    throw new Error('DB_URL must use the postgres or postgresql protocol.');
  }

  if (allowSelfSignedInternal && !internalRenderPostgresHostname.test(connectionUrl.hostname)) {
    throw new Error('DB_SSL_ALLOW_SELF_SIGNED_INTERNAL requires a Render internal PostgreSQL hostname.');
  }

  for (const parameter of [...connectionUrl.searchParams.keys()]) {
    const normalizedParameter = parameter.toLowerCase();

    if (overridingSslParameters.has(normalizedParameter)) {
      throw new Error('Remove SSL certificate options from DB_URL; configure TLS with application settings.');
    }

    if (normalizedParameter === 'sslmode') {
      const sslMode = connectionUrl.searchParams.getAll(parameter).map((value) => value.toLowerCase());

      if (sslMode.some((mode) => !sslModes.has(mode))) {
        throw new Error('DB_URL contains an unsupported or TLS-disabling sslmode.');
      }

      connectionUrl.searchParams.delete(parameter);
    }
  }

  return {
    connectionString: connectionUrl.toString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: !allowSelfSignedInternal },
  };
}

const getPool = () => {
  if (!pool) {
    pool = new Pool(createPoolConfig());
    pool.on('error', (error) => {
      console.error(`Idle PostgreSQL connection error (${safeDatabaseErrorCode(error)}).`);
    });
  }

  return pool;
};

export const database = {
  async query(statement, values = []) {
    if (/^(true|1)$/i.test(process.env.ENABLE_SQL_LOGGING ?? '')) {
      console.info(`[db] ${statement.trim().replace(/\s+/g, ' ')}`);
    }

    return getPool().query(statement, values);
  },
};

export async function testConnection() {
  const result = await getPool().query('SELECT 1');
  return result.rowCount === 1;
}