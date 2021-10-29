const parse = require('./parse');

module.exports = ({ db }) => {

  const query = () => {
    return db.asl('projects')
      .select(
        'projects.*',
        'establishments.name as establishmentName',
        'establishments.licence_number as establishmentLicenceNumber',
        db.asl('project_versions')
          .select('project_versions.data')
          .where('project_versions.project_id', db.asl.raw('projects.id'))
          .where('project_versions.status', 'granted')
          .whereNull('deleted')
          .orderBy('project_versions.updated_at', 'desc')
          .first()
          .as('data')
      )
      .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
      .whereIn('projects.status', ['active', 'expired', 'revoked'])
      .whereNull('projects.deleted');
  };

  return { query, parse: parse(db) };

};
