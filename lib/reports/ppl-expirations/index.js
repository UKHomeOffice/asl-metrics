module.exports = ({ db, query: params }) => {
  const query = () => {
    return db.asl('projects')
      .select(
        'id',
        'expiry_date',
        'schema_version'
      )
      .where({ status: 'expired' })
      .whereNull('deleted')
      .where(builder => {
        if (params.establishment) {
          const id = parseInt(params.establishment, 10);
          builder.where({ establishment_id: id });
        }
        if (params.start) {
          builder.where('expiry_date', '>', params.start);
        }
        if (params.end) {
          builder.where('expiry_date', '<=', params.end);
        }
      });
  };

  const parse = record => record;

  return { query, parse };
};
