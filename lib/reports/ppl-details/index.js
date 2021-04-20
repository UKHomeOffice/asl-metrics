const parse = require('./parse');

module.exports = ({ db }) => {

  const query = () => {
    const q = db.asl('projects')
      .select(
        'projects.*',
        'establishments.name as establishmentName',
        'establishments.licence_number as establishmentLicenceNumber',
        'profiles.first_name as licenceHolderFirstName',
        'profiles.last_name as licenceHolderLastName',
        'profiles.email as licenceHolderEmail',
        db.asl('project_versions')
          .select('project_versions.data')
          .where('project_versions.project_id', db.asl.raw('projects.id'))
          .where('project_versions.status', 'granted')
          .whereNull('deleted')
          .orderBy('project_versions.updated_at', 'desc')
          .first()
          .as('data'),
        db.asl('project_versions')
          .select('project_versions.ra_compulsory')
          .where('project_versions.project_id', db.asl.raw('projects.id'))
          .where('project_versions.status', 'granted')
          .whereNull('deleted')
          .orderBy('project_versions.updated_at', 'desc')
          .first()
          .as('ra_compulsory')
      )
      .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
      .leftJoin('profiles', 'projects.licence_holder_id', 'profiles.id')
      .whereIn('projects.status', ['active', 'expired', 'revoked'])
      .whereNull('projects.deleted');

    return q;
  };

  return { query, parse };

};
