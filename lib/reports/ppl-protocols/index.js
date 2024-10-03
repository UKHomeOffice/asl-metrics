const { intersection, some, flatten } = require('lodash');

const LEGACY_SPECIES = require('./legacy-species');

const parse = project => {
  const poles = (project.data.polesList || []).map(pole => pole.title);
  const additionalEstablishments = (project.data.establishments || []).map(est => est.name);

  const isLegacy = project.schema_version === 0;

  const yn = val => val ? 'Yes' : 'No';

  const mapProtocolToData = (protocol, index, isLegacy) => {
    const speciesList = isLegacy ? protocol.species : protocol.speciesDetails;
    const protocolTitle = isLegacy ? `${protocol.title} (legacy)` : protocol.title;

    return (speciesList || []).map((speciesObj, speciesIndex) => ({
      schemaVersion: project.schema_version,
      protocolNumber: index + 1,
      protocolTitle: protocolTitle,
      projectLicenceNumber: project.licence_number,
      projectStatus: project.status,
      animalType: `Animal type ${speciesIndex + 1}`,
      animalTypeName: isLegacy
        ? (LEGACY_SPECIES.find(s => s.value === speciesObj.speciesId) || {}).label
        : speciesObj.name,
      maximumAnimalsUsed: isLegacy ? speciesObj.quantity : speciesObj['maximum-animals'],
      maximumTimesUsed: isLegacy ? '-' : speciesObj['maximum-times-used'],
      lifeStages: speciesObj['life-stages'],
      continuedUse: isLegacy ? '-' : yn(speciesObj['continued-use']),
      reuse: isLegacy ? '-' : yn(speciesObj.reuse),
      severity: protocol.severity,
      gaas: isLegacy ? speciesObj['genetically-altered'] : yn(protocol.gaas),
      harmfulPhenotype: isLegacy ? '-' : yn(protocol['gaas-harmful']),
      noOfSteps: isLegacy ? '-' : (protocol.steps || []).length,
      noOfOptionalSteps: isLegacy ? '-' : (protocol.steps || []).filter(s => s.optional).length,
      useOfAdditionalEst: isLegacy ? '-' : yn(intersection(protocol.locations, additionalEstablishments).length),
      numberOfPoles: isLegacy ? '-' : intersection(protocol.locations, poles).length,
      adverseEffects: isLegacy ? '-' : yn(some(protocol.steps, step => step.adverse)),
      sched1: isLegacy ? '-' : yn((protocol.fate || []).includes('killed') && !protocol['non-schedule-1']),
      nonSched1: isLegacy ? '-' : yn((protocol.fate || []).includes('killed') && protocol['non-schedule-1']),
      keptAlive: yn((protocol.fate || []).includes('kept-alive')),
      continuedUseOtherProtocol: yn((protocol.fate || []).includes('continued-use')),
      continuedUseOtherProject: isLegacy ? '-' : yn((protocol.fate || []).includes('continued-use-2')),
      quantitativeData: isLegacy ? '-' : yn(protocol['quantitative-data']),
      administeringSubstances: isLegacy ? '-' : yn(protocol['justification-substances'])
    }));
  };

  return flatten(
    (project.data.protocols || [])
      .filter(protocol => protocol && !protocol.deleted)
      .flatMap((protocol, index) => mapProtocolToData(protocol, index, isLegacy))
  );
};

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

  return { query, parse };

};
