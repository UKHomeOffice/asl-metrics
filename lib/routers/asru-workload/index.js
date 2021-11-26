const { Router } = require('express');
const getWorkflowStatuses = require('../../middleware/get-workflow-statuses');
const getWorkload = require('./get-workload');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.use(getWorkflowStatuses(settings));

  router.get('/', (req, res, next) => {
    const { progress = 'open', withAsru, start, end } = req.query;
    const { db, flow } = req;

    return getWorkload({ db, flow, progress, withAsru, start, end })
      .then(results => {
        res.json(results);
      })
      .catch(next);
  });

  return router;
};
