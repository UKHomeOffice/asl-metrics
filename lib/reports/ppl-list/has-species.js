const { projectSpecies } = require('@ukhomeoffice/asl-constants');
const { intersection, flatten, values, uniq, get } = require('lodash');

const allSpecies = flatten(values(projectSpecies));

const species = {
  nhps: [
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
  ],
  catsOrDogs: [
    'cats',
    'dogs',
    'beagles',
    'other-dogs',
    // legacy values
    '7', // cats
    '11' //dogs
  ],
  equidae: [
    'horses',
    'ponies',
    'donkeys',
    'other-equidae',
    // legacy values
    '19' // horses
  ]
};

module.exports = (project, type) => {
  let value;
  const labels = species[type]
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

  const hasCodedSpecies = !!intersection(species[type], value).length;
  const hasOtherSpecies = !!intersection(labels, value).length;

  return hasCodedSpecies || hasOtherSpecies;
};
