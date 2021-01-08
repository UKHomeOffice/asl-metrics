const moment = require('moment');
const { pick, get } = require('lodash');

const hasSpecies = require('./has-species');

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

const getPermissiblePurposes = project => {
  if (get(project, 'data.training-licence') === true) {
    return '(f)';
  }

  const mappings = {
    'basic-research': '(a)',
    'translational-research-1': '(bi)',
    'translational-research-2': '(bii)',
    'translational-research-3': '(biii)',
    'safety-of-drugs': '(c)',
    'protection-of-environment': '(d)',
    'preservation-of-species': '(e)',
    'forensic-enquiries': '(g)',
    'purpose-a': '(a)',
    'purpose-b': '(b)',
    'purpose-b1': '(bi)',
    'purpose-b2': '(bii)',
    'purpose-b3': '(biii)',
    'purpose-c': '(c)',
    'purpose-d': '(d)',
    'purpose-e': '(e)',
    'purpose-f': '(f)',
    'purpose-g': '(g)'
  };
  const permissiblePurposes = get(project, 'data.permissible-purpose', []);
  const translationalResearch = get(project, 'data.translational-research', []);
  const legacyPermissiblePurpose = get(project, 'data.purpose', []);
  const legacyPermissiblePurposeB = get(project, 'data.purpose-b', []);

  if (!permissiblePurposes.length && !translationalResearch.length && !legacyPermissiblePurpose.length && !legacyPermissiblePurposeB.length) {
    return '';
  }

  return [
    ...permissiblePurposes,
    ...translationalResearch,
    ...legacyPermissiblePurpose,
    ...legacyPermissiblePurposeB
  ]
    .filter(p => p !== 'translational-research' && p !== 'purpose-b')
    .map(p => mappings[p])
    .sort()
    .join(', ');
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
