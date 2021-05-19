const { omit } = require('lodash');

const parse = establishment => establishment.authorisations.map(a => ({
  ...omit(establishment, 'authorisations'),
  authorisation_type: a && !a.deleted ? a.type : null,
  authorisation_method: a && !a.deleted ? a.method : null,
  authorisation_description: a && !a.deleted ? a.description : null
}));

module.exports = ({ db }) => {

  const query = () => {
    const q = db.asl('establishments')
      .select(
        'establishments.id',
        'establishments.name',
        'establishments.licence_number',
        'establishments.status',
        'establishments.conditions',
        db.asl.raw('JSON_AGG(authorisations) as authorisations')
      )
      .leftJoin('authorisations', 'authorisations.establishment_id', 'establishments.id')
      .groupBy('establishments.id')
      .orderBy('establishments.name');

    return q;
  };

  return { query, parse };
};
