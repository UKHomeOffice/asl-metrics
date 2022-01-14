const Knex = require('knex');
const { pick } = require('lodash');

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

  const clean = dbName => {
    if (dbName === 'flow') {
      return flow.raw('TRUNCATE TABLE cases CASCADE');
    }

    if (dbName === 'asl') {
      return Promise.resolve()
        .then(() => asl.raw('TRUNCATE TABLE profiles CASCADE'))
        .then(() => asl.raw('TRUNCATE TABLE establishments CASCADE'));
    }

    return Promise.resolve()
      .then(() => flow.raw('TRUNCATE TABLE cases CASCADE'))
      .then(() => asl.raw('TRUNCATE TABLE profiles CASCADE'))
      .then(() => asl.raw('TRUNCATE TABLE establishments CASCADE'));
  };

  const close = () => {
    return Promise.resolve()
      .then(() => asl.destroy())
      .then(() => flow.destroy());
  };

  const insertTasks = tasks => {
    return Promise.all(
      tasks.map(task => {
        return flow('cases')
          .insert(pick(task, ['id', 'status', 'data', 'created_at', 'updated_at', 'assigned_to']))
          .then(() => {
            if (task.activity) {
              return flow('activity_log').insert(task.activity);
            }
          });
      })
    );
  };

  return { asl, flow, clean, close, insertTasks };
};
