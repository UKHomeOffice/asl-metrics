const knex = require('knex');
const path = require('path');

async function getConfig() {
  const { test, development } = await import('@asl/schema/knexfile.js');
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
  const env = await getConfig();
  const knexInstance = await knex(env);
  try {
    console.log('Running migrations...');
    await knexInstance.migrate.latest({
      directory: path.resolve(__dirname, '../../../node_modules/@asl/schema/migrations')
    });
    console.log('Migrations completed.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await knexInstance.destroy();
  }
}
runMigrations();
module.exports = runMigrations;
