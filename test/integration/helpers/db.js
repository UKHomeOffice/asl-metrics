const Knex = require('knex');

module.exports = () => {
  const aslSettings = {
    database: process.env.DATABASE_NAME || 'asl-test',
    user: process.env.DATABASE_USERNAME || 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    password: process.env.DATABASE_PASSWORD || 'test-password'
  };

  const workflowSettings = {
    database: process.env.WORKFLOW_DATABASE_NAME || 'taskflow-test',
    user: process.env.WORKFLOW_DATABASE_USERNAME || 'postgres',
    host: process.env.WORKFLOW_DATABASE_HOST || 'localhost',
    password: process.env.WORKFLOW_DATABASE_PASSWORD || 'test-password'
  };

  const asl = Knex({ client: 'pg', connection: aslSettings });
  const flow = Knex({ client: 'pg', connection: workflowSettings });

  const clean = () => {
    return Promise.resolve()
      .then(() => flow('activity_log').delete())
      .then(() => flow('cases').delete())
      .then(() => asl('permissions').delete())
      .then(() => asl('project_establishments').delete())
      .then(() => asl('project_profiles').delete())
      .then(() => asl('project_versions').delete())
      .then(() => asl('projects').delete())
      .then(() => asl('profiles').delete())
      .then(() => asl('establishments').delete());
  };

  const close = () => {
    return Promise.resolve()
      .then(() => asl.destroy())
      .then(() => flow.destroy());
  };

  return { asl, flow, clean, close };
};
