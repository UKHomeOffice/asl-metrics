const { Router } = require('express');
const { pipeline } = require('stream');
const through = require('through2');
const { flatten } = require('lodash');

const getWorkflowStatuses = require('../middleware/get-workflow-statuses');

const applicationVersions = require('./application-versions');
const pils = require('./pils');
const trainingPils = require('./training-pils');
const { pilReviews, completed: completedPilReviews } = require('./pil-reviews');
const namedPeople = require('./named-people');
const pplList = require('./ppl-list');
const pplDetails = require('./ppl-details');
const pplSLA = require('./ppl-sla');
const pplApplications = require('./ppl-applications');
const pplExpirations = require('./ppl-expirations');
const pplConditions = require('./ppl-conditions');
const pplProtocols = require('./ppl-protocols');
const nts = require('./nts');
const tasks = require('./tasks');
const establishments = require('./establishments');
const establishmentConditions = require('./establishment-conditions');
const raMismatch = require('./ra-mismatch');
const newsletterSubscriptions = require('./newsletter-subscriptions');
const internalDeadlines = require('./internal-deadlines');
const internalDeadlinesTest = require('./internal-deadlines-test');
const actionedTasks = require('./actioned-tasks');

// converts a simple object mapper function into a stream handler using `through` stream middleware
const step = fn => {
  return through.obj(function (record, enc, callback) {
    Promise.resolve()
      .then(() => fn(record))
      .then(result => {
        if (Array.isArray(result)) {
          result.forEach(r => r && this.push(r));
        } else if (result) {
          this.push(result);
        }
      })
      .then(() => callback())
      .catch(callback);
  });
};

module.exports = (settings) => {

  const router = Router({ mergeParams: true });

  const reports = {
    'application-versions': applicationVersions,
    'pils': pils,
    'training-pils': trainingPils,
    'pil-reviews': pilReviews,
    'completed-pil-reviews': completedPilReviews,
    'named-people': namedPeople,
    'ppl-list': pplList,
    'ppl-details': pplDetails,
    'ppl-sla': pplSLA,
    'ppl-applications': pplApplications,
    'ppl-conditions': pplConditions,
    'ppl-expirations': pplExpirations,
    'ppl-protocols': pplProtocols,
    'nts': nts,
    'tasks': tasks,
    'establishments': establishments,
    'establishment-conditions': establishmentConditions,
    'ra-mismatch': raMismatch,
    'newsletter-subscriptions': newsletterSubscriptions,
    'internal-deadlines': internalDeadlines,
    'internal-deadlines-test': internalDeadlinesTest,
    'actioned-tasks': actionedTasks
  };

  router.use(getWorkflowStatuses(settings));

  router.get('/:report', (req, res, next) => {

    const handler = reports[req.params.report];
    if (handler) {
      const report = handler(req);
      const stream = req.query.stream !== 'false';

      if (stream) {
        // serve a newline delimited json stream
        res.set('Content-type', 'application/json');
        return pipeline(
          report.query().stream(),
          step(record => report.parse(record)),
          step(record => JSON.stringify(record) + '\n'),
          res,
          e => e && next(e)
        );
      } else {
        // serve a complete json response
        return report.query()
          .then(result => Promise.all(result.map(report.parse)))
          .then(result => flatten(result))
          .then(result => result.filter(Boolean))
          .then(result => res.json(result))
          .catch(next);
      }
    }
    next();
  });

  return router;
};
