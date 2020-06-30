const moment = require('moment');

module.exports = ({ db }) => {

  const query = () => {
    return db.asl('pils')
      .select('pils.licence_number', 'pils.review_date', 'profiles.first_name', 'profiles.last_name')
      .select('establishments.name AS establishment')
      .join('profiles', 'pils.profile_id', '=', 'profiles.id')
      .join('establishments', 'pils.establishment_id', '=', 'establishments.id')
      .where('pils.review_date', '<', moment().add(3, 'months').toISOString())
      .where({ 'pils.status': 'active' });
  };

  const parse = pil => {
    return {
      licenceNumber: pil.licence_number,
      establishment: pil.establishment,
      licenceHolder: `${pil.first_name} ${pil.last_name}`,
      reviewDate: moment(pil.review_date).format('YYYY-MM-DD')
    };
  };

  return { query, parse };

};
