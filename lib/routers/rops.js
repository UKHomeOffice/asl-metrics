const { Router } = require('express');
const { BadRequestError } = require('@asl/service/errors');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res, next) => {
    if (!req.query.year) {
      throw new BadRequestError('year must be provided');
    }

    const year = req.query.year;
    let due = 0;
    let submitted = 0;
    let outstanding = 0;

    const query = req.db.asl('projects')
      .count()
      .where('issue_date', '<=', `${year}-12-31`)
      .whereNull('deleted')
      .andWhere(builder => {
        builder
          .where({ status: 'active' })
          .orWhere(qb => {
            qb
              .where({ status: 'expired' })
              .where('expiry_date', '>=', `${year}-01-01`);
          })
          .orWhere(qb => {
            qb
              .where({ status: 'revoked' })
              .where('revocation_date', '>=', `${year}-01-01`);
          });
      });

    const projectsWithRopsQuery = query.clone()
      .whereExists(builder => {
        builder.select('id')
          .from('rops')
          .where({ status: 'submitted' })
          .whereRaw('rops.project_id = projects.id')
          .whereNull('deleted');
      });

    const ropsQuery = req.db.asl('rops')
      .countDistinct('project_id')
      .where({ year, status: 'submitted' })
      .whereNull('deleted');

    Promise.resolve()
      .then(() => query)
      .then(projects => {
        due = parseInt(projects[0].count, 10);
      })
      .then(() => {
        console.log(projectsWithRopsQuery.toString());
        return projectsWithRopsQuery;
      })
      // .then(() => {
      //   console.log(ropsQuery.toString());
      //   return ropsQuery;
      // })
      .then(rops => {
        console.log(rops);
        submitted = parseInt(rops[0].count, 10);
        outstanding = due - submitted;
        res.json({ year, due, submitted, outstanding });
      })
      .catch(next);
  });

  return router;

};
