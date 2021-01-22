const moment = require('moment');
const { get } = require('lodash');
const getPermissiblePurposes = require('../ppl-list/get-permissible-purposes');

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

const hasAutoRA = project => yesOrNo(project, 'version.ra_compulsory');

const hasInspectorRA = project => {
  const raCompulsory = get(project, 'version.ra_compulsory', false);
  const retrospectiveAssessment = get(project, 'version.data.retrospectiveAssessment', false);
  return !raCompulsory && retrospectiveAssessment;
};

const getSpeciesList = project => (get(project, 'species') || []).join(', ');

const getAdditionalAvailabilityCount = project => (get(project, 'version.data.establishments') || []).length;

const getPolesCount = project => {
  return project.schema_version === 0 ? 'unknown' : (get(project, 'version.data.polesList') || []).length;
};

const getProtocolCount = project => (get(project, 'version.data.protocols') || []).length;

const getHighestSeverity = project => {
  let severities = ['unknown', 'mild', 'moderate', 'severe', 'non-recovery'];

  return (get(project, 'version.data.protocols') || []).reduce((highestSeverity, protocol) => {
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
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.nmbas-used');
};

const useOfNonPurposeBredAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.purpose-bred', { invert: true });
};

const useOfGAAnimals = project => {
  const protocols = (get(project, 'version.data.protocols') || []);
  if (project.schema_version === 0) {
    return protocols.some(protocol => {
      return (get(protocol, 'species') || []).some(s => s['genetically-altered']);
    }) ? 'yes' : 'no';
  }
  return protocols.some(protocol => protocol.gaas) ? 'yes' : 'no';
};

const useOfEndangeredAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.endangered-animals');
};

const useOfWildAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.wild-animals');
};

const useOfFeralAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.feral-animals');
};

const useOfCommercialSlaughter = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.commercial-slaughter');
};

const useOfHumanMaterial = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.animals-containing-human-material');
};

const useOfBothSexes = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.experimental-design-sexes');
};

const translationalResearch = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.funding-basic-translational');
};

const dataForRegAuthorities = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.scientific-background-producing-data');
};

const serviceToOthers = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.scientific-background-producing-data-service');
};

const nonRegTesting = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.scientific-background-non-regulatory');
};

const productionOfGAAnimals = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.scientific-background-genetically-altered');
};

const manufactureOfMedicines = project => {
  return project.schema_version === 0 ? 'unknown' : yesOrNo(project, 'version.data.scientific-background-vaccines');
};

const isContinuation = project => {
  if (project.schema_version === 0) {
    return yesOrNo(project, 'version.data.continuation');
  }
  return get(project, 'version.data.project-continuation', []).length > 0 ? 'yes' : 'no';
};

const parse = project => {
  return {
    licence_number: project.licence_number,
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
