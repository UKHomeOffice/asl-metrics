const api = require('@asl/service/api');
const { NotFoundError } = require('@asl/service/errors');
const errorHandler = require('@asl/service/lib/error-handler');
const Knex = require('knex');

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

  app.get('/active-licences', (req, res, next) => {
    Promise.resolve()
      .then(() => {
        const queries = ['projects', 'pils', 'training_pils', 'establishments']
          .map(type => {
            return req.db.asl(type)
              .count()
              .where({ status: 'active' })
              .whereNull('deleted')
              .then(result => parseInt(result[0].count, 10));
          });
        return Promise.all(queries);
      })
      .then(([projects, pils, trainingPils, establishments]) => {
        res.json({
          projects,
          pils,
          trainingPils,
          establishments
        });
      })
      .catch(next);
  });

  app.use(() => {
    throw new NotFoundError();
  });

  app.use(errorHandler(settings));

  return app;
};
