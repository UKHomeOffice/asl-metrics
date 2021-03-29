module.exports = ({ db, query: params }) => {

  const query = () => {

    if (!params || !params.year) {
      return db.asl('projects')
        .select(db.asl.raw(`date_part('year', projects.issue_date) AS year`))
        .count()
        .whereIn('projects.status', ['active', 'expired', 'revoked'])
        .groupByRaw('year')
        .orderBy('year', 'asc');
    }

    return db.asl('projects')
      .select(
        'projects.*',
        'establishments.name',
        db.asl('project_versions')
          .select('project_versions.data')
          .where('project_versions.project_id', db.asl.raw('projects.id'))
          .where('project_versions.status', 'granted')
          .orderBy('project_versions.updated_at', 'desc')
          .first()
          .as('data')
      )
      .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
      .whereIn('projects.status', ['active', 'expired', 'revoked'])
      .where(db.asl.raw(`date_part('year', projects.issue_date) = '${params.year}'`));
  };

  const parse = project => {
    return project;
  };

  return { query, parse };

};
