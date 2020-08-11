module.exports = ({ db }) => {

  const query = () => {
    return db.asl('establishments')
      .select(
        'establishments.*',
        // DISTINCT is required to dedupe the profiles
        db.asl.raw("JSON_AGG(DISTINCT jsonb_build_object('id', pelh.id, 'first_name', pelh.first_name, 'last_name', pelh.last_name)) as pelh"),
        db.asl.raw("JSON_AGG(DISTINCT jsonb_build_object('id', asru.id, 'first_name', asru.first_name, 'last_name', asru.last_name)) as asru")
      )

      // PELH/NPRC
      .leftJoin('roles', builder => {
        builder.on('roles.establishment_id', '=', 'establishments.id')
          .andOn(b2 => {
            // filter the roles in the join, otherwise it only returns establishments with those roles assigned
            // onVal() is used here because on() causes pelh to be double-quoted and Postgres thinks it's a column name
            // onVal isn't currently documented but it was added here: https://github.com/knex/knex/pull/2746
            b2.onVal('roles.type', '=', 'pelh')
              .orOnVal('roles.type', '=', 'nprc');
          });
      })
      .leftJoin('profiles AS pelh', 'pelh.id', 'roles.profile_id')

      // inspectors and spocs
      .leftJoin('asru_establishment', 'asru_establishment.establishment_id', 'establishments.id')
      .leftJoin('profiles AS asru', 'asru.id', 'asru_establishment.profile_id')

      .groupBy('establishments.id')
      .orderBy('establishments.name');
  };

  const parse = establishment => {
    return Promise.all([
      // active ppls
      db.asl('projects')
        .count('*')
        .where({ establishment_id: establishment.id, status: 'active' })
        .then(activePplCount => parseInt(activePplCount[0].count, 10)),

      // submitted draft ppls: has at least one submitted version
      db.asl('projects')
        .count('*')
        .where({ establishment_id: establishment.id, status: 'inactive' })
        .whereExists(builder => {
          builder.select('id')
            .from('project_versions')
            .where('status', 'submitted')
            .whereRaw('project_versions.project_id = projects.id');
        })
        .then(submittedDraftsCount => parseInt(submittedDraftsCount[0].count, 10)),

      // unsubmitted draft ppls: has no submitted versions
      db.asl('projects')
        .count('*')
        .where({ establishment_id: establishment.id, status: 'inactive' })
        .whereNotExists(builder => {
          builder.select('id')
            .from('project_versions')
            .where('status', 'submitted')
            .whereRaw('project_versions.project_id = projects.id');
        })
        .then(unsubmittedDraftsCount => parseInt(unsubmittedDraftsCount[0].count, 10))
    ])
      .then(([activeProjectCount, submittedDraftsCount, unsubmittedDraftsCount]) => {
        return {
          ...establishment,
          // filter null profiles
          pelh: establishment.pelh.filter(p => p.id),
          asru: establishment.asru.filter(p => p.id),
          activeProjectCount,
          submittedDraftsCount,
          unsubmittedDraftsCount
        };
      });
  };

  return { query, parse };

};
