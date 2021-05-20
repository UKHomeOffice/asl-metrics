module.exports = ({ db }) => {
  const query = () => {
    const q = db.asl('establishments')
      .select(
        'establishments.id',
        'establishments.name',
        'establishments.licence_number',
        'establishments.status',
        'establishments.conditions',
        'authorisations.type AS authorisation_type',
        'authorisations.method AS authorisation_method',
        'authorisations.description AS authorisation_description'
      )
      .leftJoin('authorisations', 'authorisations.establishment_id', 'establishments.id')
      .whereNull('establishments.deleted')
      .whereNull('authorisations.deleted')
      .orderBy('establishments.name');

    return q;
  };

  const parse = establishment => establishment;

  return { query, parse };
};
