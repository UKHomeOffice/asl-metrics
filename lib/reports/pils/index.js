const moment = require('moment');

const formatDate = date => {
  return date ? moment(date).format('YYYY-MM-DD') : '';
};

module.exports = ({ db }) => {

  const query = () => {
    return db.asl('pils')
      .select('pils.*')
      .select('profiles.pil_licence_number AS profile_licence_number')
      .select('establishments.name AS establishment')
      .join('profiles', 'pils.profile_id', '=', 'profiles.id')
      .join('establishments', 'pils.establishment_id', '=', 'establishments.id')
      .whereIn('pils.status', [ 'active', 'revoked' ]);
  };

  const parse = pil => {

    const hasCategory = cat => {
      return (pil.procedures || []).includes(cat);
    };

    return {
      licenceNumber: pil.licence_number || pil.profile_licence_number,
      status: pil.status,
      catA: hasCategory('A'),
      catB: hasCategory('B'),
      catC: hasCategory('C'),
      catD: hasCategory('D'),
      catE: false,
      catF: hasCategory('F'),
      catFNotes: hasCategory('F') ? pil.notes_cat_f : '',
      species: (pil.species || []).join(', '),
      establishment: pil.establishment,
      issueDate: formatDate(pil.issue_date),
      revocationDate: formatDate(pil.revocation_date),
      reviewDate: formatDate(pil.review_date),
      lastAmended: formatDate(pil.updated_at)
    };
  };

  return { query, parse };

};
