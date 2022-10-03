const { Router } = require('express');
const { pipeline } = require('stream');
const through = require('through2');
const { flatten } = require('lodash');

const getWorkflowStatuses = require('../middleware/get-workflow-statuses');

const reports = {
  'application-versions': require('./application-versions'),
  'pils': require('./pils'),
  'training-pils': require('./training-pils'),
  'pil-reviews': require('./pil-reviews').pilReviews,
  'completed-pil-reviews': require('./pil-reviews').completed,
  'named-people': require('./named-people'),
  'ppl-list': require('./ppl-list'),
  'ppl-details': require('./ppl-details'),
  'ppl-sla': require('./ppl-sla'),
  'ppl-applications': require('./ppl-applications'),
  'ppl-conditions': require('./ppl-conditions'),
  'ppl-expirations': require('./ppl-expirations'),
  'ppl-protocols': require('./ppl-protocols'),
  'nts': require('./nts'),
  'tasks': require('./tasks'),
  'establishments': require('./establishments'),
  'establishment-conditions': require('./establishment-conditions'),
  'ra-mismatch': require('./ra-mismatch'),
  'newsletter-subscriptions': require('./newsletter-subscriptions'),
  'internal-deadlines': require('./internal-deadlines'),
  'actioned-tasks': require('./actioned-tasks'),
  'condition-reminders': require('./condition-reminders')
};

// converts a simple object mapper function into a stream handler using `through` stream middleware
const step = fn => {
  return through.obj(function (record, enc, callback) {
    console.log(record);
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
