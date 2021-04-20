const api = require('@asl/service/api');
const { NotFoundError } = require('@asl/service/errors');
const errorHandler = require('@asl/service/lib/error-handler');
const Knex = require('knex');
const types = require('pg').types;

const INT4_OID = 23;
const INT8_OID = 20;

const intParseFn = val => {
  return val === null ? null : parseInt(val, 10);
};

// WARNING: numbers larger than Number.MAX_SAFE_INTEGER will overflow and give different results
types.setTypeParser(INT4_OID, intParseFn);
types.setTypeParser(INT8_OID, intParseFn);

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
