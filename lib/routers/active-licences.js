const { Router } = require('express');

module.exports = settings => {
  const router = Router({ mergeParams: true });
  const endTime = ' 23:59:59.999+00';
  const startTime = ' 00:00:00+00';

  router.get('/', (req, res, next) => {
    Promise.resolve()
      .then(() => {
        const queries = ['projects', 'pils', 'training_pils', 'establishments']
          .map(type => {
            return req.db.asl(type)
              .count()
              .where({ status: 'active' })
              .andWhere('issue_date', '<=', req.query.end + endTime) // ignore issued after report period
              .orWhere({ status: 'revoked' })
              .andWhere('issue_date', '<=', req.query.end + endTime)
              .andWhere('revocation_date', '>', req.query.end + startTime)
              .orWhere(builder => {
                if (type === 'projects' || type === 'training_pils') {
                  return builder.orWhere({ status: 'expired' })
                    .andWhere('issue_date', '<=', req.query.end + endTime)
                    .andWhere('expiry_date', '>', req.query.end + startTime);
                }
              })
              .where(builder => {
                if (req.query.establishment) {
                  const id = parseInt(req.query.establishment, 10);
                  switch (type) {
                    case 'pils':
                    case 'projects':
                      return builder.where({ establishment_id: id });
                    case 'establishments':
                      return builder.where({ id });
                    case 'training_pils':
                      return builder.whereExists(function () {
                        return this.select('*').from('training_courses')
                          .where({ establishment_id: id })
                          .whereRaw('training_courses.id = training_pils.training_course_id');
                      });
                  }
                }
              })
              .then(result => result[0].count);
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

  return router;

};
