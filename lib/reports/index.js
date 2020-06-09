const { Router } = require('express');
const { pipeline } = require('stream');
const through = require('through2');
const { flatten } = require('lodash');

const pilReviews = require('./pil-reviews');
const namedPeople = require('./named-people');
const pplList = require('./ppl-list');
const pplConditions = require('./ppl-conditions');

module.exports = () => {
  const router = Router({ mergeParams: true });

  const step = fn => {
    return through.obj(function (record, enc, callback) {
      try {
        const result = fn(record);
        if (Array.isArray(result)) {
          result.forEach(r => this.push(r));
        } else {
          this.push(result);
        }
        callback();
      } catch (e) {
        callback(e);
      }
    });
  };

  router.use((req, res, next) => {
    req.stream = req.query.stream !== 'false';
    next();
  });

  router.get('/:report', (req, res, next) => {
    const reports = {
      'pil-reviews': pilReviews,
      'named-people': namedPeople,
      'ppl-list': pplList,
      'ppl-conditions': pplConditions
    };
    const handler = reports[req.params.report];
    if (handler) {
      const report = handler(req);
      if (req.stream) {
        // serve a newline delimited json stream
        res.set('Content-type', 'application/json');
        const parser = report.parse();
        return pipeline(
          report.query().stream(),
          step(record => parser(record)),
          step(record => JSON.stringify(record) + '\n'),
          res,
          e => e && next(e)
        );
      } else {
        // serve a complete json response
        return report.query()
          .then(result => flatten(result.map(report.parse())))
          .then(result => res.json(result))
          .catch(next);
      }
    }
    next();
  });

  return router;
};
