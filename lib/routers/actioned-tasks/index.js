const { Router } = require('express');
const getWorkflowStatuses = require('../../middleware/get-workflow-statuses');
const getStats = require('./get-stats');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.use(getWorkflowStatuses(settings));

  router.get('/', (req, res, next) => {
    const { start, end } = req.query;
    const { db, flow } = req;

    return getStats({ db, flow, start, end })
      .then(results => {
        res.json(results);
      })
      .catch(next);
  });

  return router;
};
