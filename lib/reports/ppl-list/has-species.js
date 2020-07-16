const { projectSpecies } = require('@asl/constants');
const { intersection, flatten, values, uniq, get } = require('lodash');

const allSpecies = flatten(values(projectSpecies));

module.exports = (project, species) => {
  let value;
  const labels = species
    .map(n => allSpecies.find(s => s.value === n))
    .filter(Boolean)
    .map(s => s.label);

  // schema_version is not camelCased because it came from a raw knex query
  if (project.schema_version === 1) {
    value = []
      .concat(get(project, 'data.species', []))
      .concat(get(project, 'data.species-other', []));
  } else {
    const protocols = get(project, 'data.protocols', []);
    value = protocols
      .map(p => {
        return (p.species || []).map(s => s.speciesId === '28' ? s['other-species-type'] : s.speciesId);
      });
  }
  value = uniq(flatten(value));

  const hasCodedSpecies = !!intersection(species, value).length;
  const hasOtherSpecies = !!intersection(labels, value).length;

  return hasCodedSpecies || hasOtherSpecies;
};
