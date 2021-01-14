const moment = require('moment');
const { pick } = require('lodash');

const hasSpecies = require('./has-species');
const getPermissiblePurposes = require('./get-permissible-purposes');

const nhps = [
  'prosimians',
  'marmosets',
  'cynomolgus',
  'rhesus',
  'vervets',
  'baboons',
  'squirrel-monkeys',
  'other-old-world',
  'other-new-world',
  'other-nhps',
  'apes',
  // legacy values
  '21', // new world NHPs
  '22' // old world NHPs
];

const catsOrDogs = [
  'cats',
  'dogs',
  'beagles',
  'other-dogs',
  // legacy values
  '7', // cats
  '11' //dogs
];

const equidae = [
  'horses',
  'ponies',
  'donkeys',
  'other-equidae',
  // legacy values
  '19' // horses
];

const formatDuration = project => {
  if (!project.data || !project.data.duration) {
    return '-';
  }
  return `${project.data.duration.years} years ${project.data.duration.months} months`;
};

const parse = project => {
  return {
    ...pick(project, 'licence_number', 'title', 'status', 'schema_version'),
    isPartialRecord: project.is_legacy_stub,
    issueDate: moment(project.issue_date).format('YYYY-MM-DD'),
    expiryDate: moment(project.expiry_date).format('YYYY-MM-DD'),
    revocationDate: project.revocation_date ? moment(project.revocation_date).format('YYYY-MM-DD') : '',
    duration: formatDuration(project),
    establishment: project.name,
    nhps: hasSpecies(project, nhps) ? 'yes' : 'no',
    catsOrDogs: hasSpecies(project, catsOrDogs) ? 'yes' : 'no',
    equidae: hasSpecies(project, equidae) ? 'yes' : 'no',
    raDate: project.ra_date ? moment(project.ra_date).format('YYYY-MM-DD') : '',
    permissiblePurposes: getPermissiblePurposes(project),
    establishmentLicenceNumber: project.establishmentLicenceNumber
  };
};

module.exports = parse;
