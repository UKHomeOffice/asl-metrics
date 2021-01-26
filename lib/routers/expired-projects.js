const { Router } = require('express');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res, next) => {
    Promise.resolve()
      .then(() => {
        return req.db.asl('projects')
          .select('schema_version')
          .count('*')
          .where({ status: 'expired' })
          .whereNull('deleted')
          .where(builder => {
            if (req.query.establishment) {
              const id = parseInt(req.query.establishment, 10);
              builder.where({ establishment_id: id });
            }
            if (req.query.start) {
              builder.where('expiry_date', '>', req.query.start);
            }
            if (req.query.end) {
              builder.where('expiry_date', '<=', req.query.end);
            }
          })
          .groupBy('schema_version');
      })
      .then(result => {
        const counts = result.reduce((map, row) => {
          return { ...map, [row.schema_version]: parseInt(row.count, 10) };
        }, { '0': 0, '1': 0 });
        res.json(counts);
      })
      .catch(next);
  });

  return router;
};
