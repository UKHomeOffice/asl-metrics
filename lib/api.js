const api = require('@asl/service/api');
const errorHandler = require('@asl/service/lib/error-handler');
const db = require('@asl/schema');
const Taskflow = require('@ukhomeoffice/taskflow');

module.exports = (settings) => {
  const app = api(settings);
  const schema = db(settings.db);
  const flow = Taskflow({ db: settings.taskflowDB });

  const { Task } = flow;
  const { Establishment } = schema;

  app.get('/', (req, res, next) => {
    const queries = [
      Task.query().count(),
      Establishment.query().count()
    ];
    Promise.all(queries)
      .then(results => res.json(results))
      .catch(next);
  });

  app.use(errorHandler(settings));

  return app;
};
