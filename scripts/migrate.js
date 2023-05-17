/* eslint-disable implicit-dependencies/no-implicit */
const Taskflow = require('@ukhomeoffice/asl-taskflow');

const db = {
  database: process.env.WORKFLOW_DATABASE_NAME || 'taskflow-test',
  user: process.env.WORKFLOW_DATABASE_USERNAME || 'postgres',
  host: process.env.WORKFLOW_DATABASE_HOST || 'localhost',
  password: process.env.WORKFLOW_DATABASE_PASSWORD || 'test-password'
};
Promise.resolve()
  .then(() => {
    console.log('migrate taskflow test db');
    return Taskflow({ db }).migrate();
  })
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err.stack);
    process.exit(1);
  });
