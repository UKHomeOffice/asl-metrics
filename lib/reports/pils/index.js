const moment = require('moment');
const { pick } = require('lodash');

const formatDate = date => {
  return date ? moment(date).format('YYYY-MM-DD') : '';
};

module.exports = ({ db }) => {

  const hasActivePil = builder => builder.select('id')
    .from('pils')
    .whereIn('pils.status', [ 'active', 'revoked' ])
    .whereRaw('pils.profile_id = profiles.id');

  const hasActiveCatE = builder => builder.select('id')
    .from('training_pils')
    .whereIn('training_pils.status', [ 'active', 'revoked' ])
    .whereRaw('training_pils.profile_id = profiles.id');

  const trainingPil = () => db.asl('training_pils')
    .where('training_pils.profile_id', db.asl.ref('profiles.id'))
    .orderBy('training_pils.issue_date', 'desc')
    .limit(1);

  const trainingCourse = () => trainingPil()
    .join('training_courses', 'training_courses.id', 'training_pils.training_course_id');

  const query = () => {
    return db.asl('profiles')
      .leftJoin('pils', 'pils.profile_id', '=', 'profiles.id')
      .leftJoin('training_pils', 'training_pils.profile_id', '=', 'profiles.id')
      .where(builder => {
        builder
          .whereExists(hasActivePil)
          .orWhereExists(hasActiveCatE)
      })
      .select({
        profileId: 'profiles.id',
        licenceNumber: 'profiles.pil_licence_number',
        pilId: 'pils.id',
        pilStatus: 'pils.status',
        pilProcedures: 'pils.procedures',
        pilCatFNotes: 'pils.notes_cat_f',
        pilSpecies: 'pils.species',
        pilIssueDate: 'pils.issue_date',
        pilRevocationDate: 'pils.revocation_date',
        pilReviewDate: 'pils.review_date',
        pilLastAmended: 'pils.updated_at',
      },
        // db.asl.raw('JSON_AGG(training_pils.* ORDER BY training_pils.issue_date desc) as training_pils')
        trainingPil().select('training_pils.id').as('trainingPilId'),
        trainingPil().select('training_pils.status').as('trainingPilStatus'),
        trainingPil().select('training_pils.issue_date').as('trainingPilIssueDate'),
        trainingPil().select('training_pils.expiry_date').as('trainingPilExpiryDate'),
        trainingPil().select('training_pils.revocation_date').as('trainingPilRevocationDate'),
        trainingPil().select('training_pils.updated_at').as('trainingPilLastUpdated'),
        trainingCourse().select('training_courses.title').as('trainingPilCourseTitle'),
        trainingCourse().select('training_courses.species').as('trainingPilSpecies'),
        trainingCourse()
          .join('projects', 'training_courses.project_id', 'projects.id')
          .select('projects.title')
          .as('trainingPilProjectTitle'),
        trainingCourse()
          .join('projects', 'training_courses.project_id', 'projects.id')
          .select('projects.licence_number')
          .as('trainingPilProjectLicenceNumber'),
        trainingCourse()
          .join('establishments', 'training_courses.establishment_id', 'establishments.id')
          .select('establishments.name')
          .as('trainingPilEstablishment')
      )
      .groupBy('profiles.id', 'pils.id', 'training_pils.id')
  };

  const parse = row => {

    const hasCategory = cat => {
      return (row.pilProcedures || []).includes(cat);
    };

    const establishment = row.pilEstablishment || row.trainingPilEstablishment;

    return {
      licenceNumber: row.licenceNumber,
      status: row.status,
      catA: hasCategory('A'),
      catB: hasCategory('B'),
      catC: hasCategory('C'),
      catD: hasCategory('D'),
      catE: row.trainingPilId,
      ...pick(row,
        'trainingPilStatus',
        'trainingPilCourseTitle',
        'trainingPilProjectTitle',
        'trainingPilProjectLicenceNumber',
        'trainingPilEstablishment'
      ),
      trainingPilSpecies: (row.trainingPilSpecies || []).join(', '),
      trainingPilIssueDate: formatDate(row.trainingPilIssueDate),
      trainingPilExpiryDate: formatDate(row.trainingPilExpiryDate),
      trainingPilRevocationDate: formatDate(row.trainingPilRevocationDate),
      trainingPilLastUpdated: formatDate(row.trainingPilLastUpdated),
      catF: hasCategory('F'),
      catFNotes: hasCategory('F') ? row.pilCatFNotes : '',
      species: (row.pilSpecies || []).join(', '),
      establishment: establishment,
      issueDate: formatDate(row.pilIssueDate),
      revocationDate: formatDate(row.pilRevocationDate),
      reviewDate: formatDate(row.pilReviewDate),
      lastAmended: formatDate(row.pilLastAmended)
    };
  };

  return { query, parse };

};
