const moment = require('moment');

module.exports = ({ db }) => {
  const query = () => {
    return db.flow('cases')
      .select(
        'updated_at',
        db.flow.raw(`cases.data->>'id' AS pil_id`)
      )
      .whereRaw(`cases.data->>'model' = 'pil'`)
      .whereRaw(`cases.data->>'action' = 'review'`)
      .whereIn('status', ['resolved', 'autoresolved'])
      .orderBy('updated_at');
  };

  const parse = c => {
    return db.asl('pils')
      .select('pils.licence_number', 'pils.status', 'profiles.first_name', 'profiles.last_name')
      .select('establishments.name AS establishment')
      .join('profiles', 'pils.profile_id', '=', 'profiles.id')
      .join('establishments', 'pils.establishment_id', '=', 'establishments.id')
      .where({ 'pils.id': c.pil_id })
      .first()
      .then(pil => {
        return {
          licenceNumber: pil.licence_number,
          establishment: pil.establishment,
          licenceHolder: `${pil.first_name} ${pil.last_name}`,
          status: pil.status,
          reviewDate: moment(c.updated_at).format('YYYY-MM-DD')
        };
      });
  };

  return { query, parse };
};
