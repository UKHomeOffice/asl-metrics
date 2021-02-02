const ra = require('./retrospective-assessment');

module.exports = ({ db }) => {

  const query = () => {
    const q = db.asl('projects')
      .select(
        'projects.*',
        'establishments.name as establishmentName',
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
      .whereIn('projects.status', ['active', 'expired', 'revoked'])
      .whereNull('projects.deleted');

    return q;
  };

  const parse = record => {

    const calculated = ra.isRequired(record.data);

    return {
      licence_number: record.licence_number,
      ra_compulsory: !!record.ra_compulsory || false,
      calculated: !!calculated || false,
      mismatch: !!record.ra_compulsory !== !!calculated
    };
  };

  return { query, parse };

};
