process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://campusgear:campusgear@localhost:55432/campusgear_test';
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '20';
