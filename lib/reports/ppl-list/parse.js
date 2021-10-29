const moment = require('moment');
const { pick, get } = require('lodash');

const hasSpecies = require('./has-species');
const getPermissiblePurposes = require('./get-permissible-purposes');

const formatDuration = project => {
  if (!project.data || !project.data.duration) {
    return '-';
  }
  return `${project.data.duration.years} years ${project.data.duration.months} months`;
};

const parse = db => project => {

  return Promise.resolve()
    .then(() => {
      if (project.ra_date) {
        return db.flow('cases')
          .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
          .whereRaw(`data->>'action' = 'grant-ra'`)
          .whereRaw(`data->>'id' = ?`, [project.id])
          .whereRaw(`event->>'status' = 'with-inspectorate'`)
          .orderBy('activity_log.created_at', 'asc')
          .limit(1)
          .then(results => {
            project.ra_submitted_date = get(results, '[0].created_at');
          });
      }
    })
    .then(() => {
      return {
        ...pick(project, 'licence_number', 'title', 'status', 'schema_version'),
        isPartialRecord: project.is_legacy_stub,
        issueDate: moment(project.issue_date).format('YYYY-MM-DD'),
        expiryDate: moment(project.expiry_date).format('YYYY-MM-DD'),
        revocationDate: project.revocation_date ? moment(project.revocation_date).format('YYYY-MM-DD') : '',
        duration: formatDuration(project),
        establishment: project.name,
        nhps: hasSpecies(project, 'nhps') ? 'yes' : 'no',
        catsOrDogs: hasSpecies(project, 'catsOrDogs') ? 'yes' : 'no',
        equidae: hasSpecies(project, 'equidae') ? 'yes' : 'no',
        raDueDate: project.ra_date ? moment(project.ra_date).format('YYYY-MM-DD') : '',
        raSubmitDate: project.ra_submitted_date ? moment(project.ra_submitted_date).format('YYYY-MM-DD') : '',
        raGrantDate: project.ra_granted_date ? moment(project.ra_granted_date).format('YYYY-MM-DD') : '',
        permissiblePurposes: getPermissiblePurposes(project),
        establishmentLicenceNumber: project.establishmentLicenceNumber
      };
    });

};

module.exports = parse;
