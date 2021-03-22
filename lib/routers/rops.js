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

    Promise.resolve()
      .then(() => {
        const q = req.db.asl('projects')
          .select('id')
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
        return q;
      })
      .then(projects => {
        due = projects.length;
      })
      .then(() => req.db.asl('rops').select('id', 'status').where({ year }))
      .then(rops => {
        submitted = rops.filter(rop => rop.status === 'submitted').length;
        outstanding = due - submitted;
        res.json({ year, due, submitted, outstanding });
      })
      .catch(next);
  });

  return router;

};
