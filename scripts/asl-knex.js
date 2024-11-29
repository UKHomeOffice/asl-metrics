const knex = require('knex');

/**
 * @return knexInstance - knex instance to query DB.
 * @usuage
 *   // ...knexSnakeCaseMappers() is to set the knex query pattern, see ObjectionJs docs for more info.
 *   const { knexInstance: dbInstance } = dbExtra;
 *
 *   const knexInstance = Knex({
 *     ...dbInstance.client.config,
 *     ...knexSnakeCaseMappers()
 *   });
 * */
function knexInstance() {
  const env = getConfig();
  return knex(env);
}

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

module.exports = knexInstance;
