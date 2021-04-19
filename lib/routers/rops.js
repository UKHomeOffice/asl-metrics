const { Router } = require('express');
const moment = require('moment');
const { BadRequestError } = require('@asl/service/errors');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res, next) => {
    if (!req.query.year) {
      throw new BadRequestError('year must be provided');
    }

    const year = parseInt(req.query.year, 10);
    const endOfJanNextYear = moment(`${year + 1}-01-31`).endOf('day').toISOString();
    const interval28Days = `INTERVAL '29 days - 1 millisecond'`;

    let due = 0;
    let submitted = 0;
    let outstanding = 0;
    let overdue = 0;

    const query = req.db.asl('projects')
      .select('projects.id')
      .count('rops.id', {as: 'submitted_rops'})
      .select(req.db.asl.raw(`
        CASE
          WHEN projects.status = 'active' THEN LEAST('${endOfJanNextYear}'::timestamptz, DATE_TRUNC('day', projects.expiry_date) + ${interval28Days})
          WHEN projects.status = 'expired' THEN DATE_TRUNC('day', projects.expiry_date) + ${interval28Days}
          WHEN projects.status = 'revoked' THEN DATE_TRUNC('day', projects.revocation_date) + ${interval28Days}
        END rops_deadline
      `))
      .where('projects.issue_date', '<=', `${year}-12-31`)
      .whereNull('projects.deleted')
      .andWhere(builder => {
        builder
          .where('projects.status', 'active')
          .orWhere(qb => {
            qb
              .where('projects.status', 'expired')
              .where('projects.expiry_date', '>=', `${year}-01-01`);
          })
          .orWhere(qb => {
            qb
              .where('projects.status', 'revoked')
              .where('projects.revocation_date', '>=', `${year}-01-01`);
          });
      })
      .leftJoin('rops', builder => {
        builder.on('rops.project_id', '=', 'projects.id')
          .andOnVal('rops.year', year)
          .andOnVal('rops.status', 'submitted')
          .andOn(req.db.asl.raw('rops.deleted IS NULL'));
      })
      .groupBy('projects.id');

    Promise.resolve()
      .then(() => query)
      .then(projects => {
        due = projects.length;
        submitted = projects.filter(p => p.submitted_rops > 0).length;
        outstanding = due - submitted;
        const now = moment();

        projects.forEach(p => {
          if (p.submitted_rops === 0 && p.rops_deadline < now) {
            overdue++;
          }
        });

        res.json({ year, due, submitted, outstanding, overdue });
      })
      .catch(next);
  });

  return router;

};
