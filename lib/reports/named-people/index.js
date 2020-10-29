module.exports = ({ db }) => {

  const query = () => {
    return db.asl({ p: 'profiles' })
      .select('p.first_name', 'p.last_name', 'p.email', 'p.telephone', 'p.rcvs_number')
      .select(db.asl.raw(`CASE WHEN permissions.role = 'admin' THEN 1 ELSE 0 END AS admin`))
      .select(db.asl.raw(`string_agg(DISTINCT roles.type, ', ') AS roles`))
      .select('establishments.name AS establishment')
      .select('establishments.status')
      .join('permissions', 'permissions.profile_id', '=', 'p.id')
      .join('establishments', 'permissions.establishment_id', '=', 'establishments.id')
      .leftJoin('roles', builder => {
        builder.on('roles.profile_id', '=', 'p.id').andOn('roles.establishment_id', '=', 'establishments.id');
      })
      .whereNull('roles.deleted')
      .where(builder => {
        builder
          .where('permissions.role', 'admin')
          .orWhereNotNull('roles.id');
      })
      .groupBy(['establishments.id', 'p.id', 'permissions.role'])
      .orderBy(['p.last_name', 'p.first_name', 'establishments.name']);
  };

  const parse = record => record;

  return { query, parse };

};
