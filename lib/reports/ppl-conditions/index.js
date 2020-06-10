const parse = require('./parse');

module.exports = ({ db }) => {

  const query = () => {
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
      .whereIn('projects.status', ['active', 'expired', 'revoked']);
  };

  return { query, parse };
};
