const parse = require('./parse');

module.exports = ({ db }) => {

  const query = () => {
    const q = db.asl('projects')
      .select(
        'projects.*',
        'establishments.name as establishmentName',
        db.asl.raw('to_jsonb(version) as version') // return version as nested js object
      )
      .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
      .leftJoin(
        // join latest granted version for each project
        db.asl('project_versions')
          .where('project_versions.status', 'granted')
          .whereNull('deleted')
          .groupBy('project_versions.project_id', 'project_versions.id') // group by limits results to 1 per project
          .orderBy('project_versions.updated_at', 'desc')
          .as('version'),
        'projects.id',
        'version.project_id'
      )
      .whereIn('projects.status', ['active', 'expired', 'revoked'])
      .whereNull('projects.deleted');

    return q;
  };

  return { query, parse };

};
