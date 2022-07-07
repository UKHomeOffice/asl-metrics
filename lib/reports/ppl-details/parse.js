const moment = require('moment');
const { get } = require('lodash');
const getPermissiblePurposes = require('../ppl-list/get-permissible-purposes');
const hasSpecies = require('../ppl-list/has-species');

const yesOrNo = (project, path, options = {}) => {
  let value = get(project, path);
  // if value is undefined always return no
  if (value === undefined) {
    return 'no';
  }
  if (options.invert) {
    value = !value;
  }
  return value ? 'yes' : 'no';
};

const isLegacy = project => project.schema_version === 0 ? 'yes' : 'no';

const hasAutoRA = project => yesOrNo(project, 'ra_compulsory');

const hasInspectorRA = project => {
  const raCompulsory = get(project, 'ra_compulsory', false);
  const retrospectiveAssessment = get(project, 'data.retrospectiveAssessment', false);
  return (!raCompulsory && retrospectiveAssessment) ? 'yes' : 'no';
};

const getSpeciesList = project => (get(project, 'species') || []).join(', ');

const getAdditionalAvailabilityCount = project => (get(project, 'data.establishments') || []).length;

const getPolesCount = project => {
  return project.schema_version === 0 ? 'unknown' : (get(project, 'data.polesList') || []).length;
};

const getProtocolCount = project => (get(project, 'data.protocols') || []).filter(Boolean).length;

const getHighestSeverity = project => {
  let severities = ['unknown', 'non-recovery', 'mild', 'moderate', 'severe'];

  return (get(project, 'data.protocols') || []).filter(Boolean).reduce((highestSeverity, protocol) => {
    if (protocol.severity) {
      const protocolSeverity = protocol.severity.toLowerCase();
      if (severities.indexOf(protocolSeverity) > severities.indexOf(highestSeverity)) {
        highestSeverity = protocolSeverity;
      }
    }
    return highestSeverity;
  }, 'unknown');
};

const useOfNMBA = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.nmbas-used');
};

const useOfNonPurposeBredAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.purpose-bred', { invert: true });
};

const useOfGAAnimals = project => {
  const protocols = (get(project, 'data.protocols') || []).filter(Boolean);
  if (project.schema_version === 0) {
    return protocols.some(protocol => {
      return (get(protocol, 'species') || []).some(s => s['genetically-altered']);
    }) ? 'yes' : 'no';
  }
  return protocols.some(protocol => protocol.gaas) ? 'yes' : 'no';
};

const useOfEndangeredAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.endangered-animals');
};

const useOfWildAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.wild-animals');
};

const useOfFeralAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.feral-animals');
};

const useOfCommercialSlaughter = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.commercial-slaughter');
};

const useOfHumanMaterial = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.animals-containing-human-material');
};

const useOfBothSexes = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.experimental-design-sexes');
};

const translationalResearch = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.funding-basic-translational');
};

const dataForRegAuthorities = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.scientific-background-producing-data');
};

const serviceToOthers = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.scientific-background-producing-data-service');
};

const nonRegTesting = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.scientific-background-non-regulatory');
};

const productionOfGAAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.scientific-background-genetically-altered');
};

const manufactureOfMedicines = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'data.scientific-background-vaccines');
};

const isContinuation = project => {
  if (project.schema_version === 0) {
    return yesOrNo(project, 'data.continuation');
  }
  return get(project, 'data.project-continuation', []).length > 0 ? 'yes' : 'no';
};

const formatDuration = project => {
  if (!project.data || !project.data.duration) {
    return '-';
  }
  return `${project.data.duration.years} years ${project.data.duration.months} months`;
};

const parse = project => {
  return {
    licence_number: project.licence_number,
    title: project.title,
    duration: formatDuration(project),
    establishment: project.establishmentName,
    establishmentLicenceNumber: project.establishmentLicenceNumber,
    raDate: project.ra_date ? moment(project.ra_date).format('YYYY-MM-DD') : '',
    nhps: hasSpecies(project, 'nhps') ? 'yes' : 'no',
    catsOrDogs: hasSpecies(project, 'catsOrDogs') ? 'yes' : 'no',
    equidae: hasSpecies(project, 'equidae') ? 'yes' : 'no',
    licenceHolder: `${project.licenceHolderFirstName} ${project.licenceHolderLastName}`,
    licenceHolderEmail: project.licenceHolderEmail,
    legacy: isLegacy(project),
    establishment_name: project.establishment_name,
    status: project.status,
    issue_date: moment(project.issue_date).format('YYYY-MM-DD'),
    expiry_date: moment(project.expiry_date).format('YYYY-MM-DD'),
    revocation_date: project.revocation_date ? moment(project.revocation_date).format('YYYY-MM-DD') : '',
    has_auto_RA: hasAutoRA(project),
    has_inspector_RA: hasInspectorRA(project),
    permissible_purposes: getPermissiblePurposes(project),
    animal_types: getSpeciesList(project),
    additional_availability_count: getAdditionalAvailabilityCount(project),
    poles_count: getPolesCount(project),
    protocol_count: getProtocolCount(project),
    highest_severity: getHighestSeverity(project),
    use_of_NMBA: useOfNMBA(project),
    use_of_non_purpose_bred: useOfNonPurposeBredAnimals(project),
    use_of_GA: useOfGAAnimals(project),
    use_of_endangered: useOfEndangeredAnimals(project),
    use_of_wild: useOfWildAnimals(project),
    use_of_feral: useOfFeralAnimals(project),
    use_of_commercial_slaughter: useOfCommercialSlaughter(project),
    use_of_human_material: useOfHumanMaterial(project),
    translational_research: translationalResearch(project),
    data_for_reg_authorities: dataForRegAuthorities(project),
    service_to_others: serviceToOthers(project),
    non_reg_testing: nonRegTesting(project),
    production_of_ga_animals: productionOfGAAnimals(project),
    manufacture_of_medicines: manufactureOfMedicines(project),
    ppl_continuation: isContinuation(project),
    use_of_both_sexes: useOfBothSexes(project)
  };
};

module.exports = parse;
