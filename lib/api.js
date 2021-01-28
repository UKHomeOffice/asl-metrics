const api = require('@asl/service/api');
const { NotFoundError } = require('@asl/service/errors');
const errorHandler = require('@asl/service/lib/error-handler');
const Knex = require('knex');

const activeLicences = require('./routers/active-licences');
const reports = require('./reports');

module.exports = (settings) => {

  const app = api(settings);
  const asl = Knex({ client: 'pg', connection: settings.asldb });
  const flow = Knex({ client: 'pg', connection: settings.workflowdb });

  app.use((req, res, next) => {
    req.db = { asl, flow };
    next();
  });

  app.use('/reports', reports(settings));

  app.use('/active-licences', activeLicences(settings));

  app.use(() => {
    throw new NotFoundError();
  });

  app.use(errorHandler(settings));

  return app;
};
