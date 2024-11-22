const knex = require('knex');
const path = require('path');

async function getConfig() {
  const { test, development } = await import('@asl/schema/knexfile');
  let env = null;
  if (process.env.NODE_ENV === 'test') {
    env = test;
    return env;
  } if (process.env.NODE_ENV === 'development') {
    env = development;
    return env;
  }
}

/**
 * @return void - run latest migration.
 * */
async function runMigrations() {
  const env = getConfig();
  knex(env);
  try {
    console.log('Running migrations...');
    await knex.migrate.latest({
      directory: path.resolve(__dirname, '../../node_modules/@asl/schema/migrations') // Ensure migration dir points to dependency
    });
    console.log('Migrations completed.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await knex.destroy();
  }
}

module.exports = runMigrations;
