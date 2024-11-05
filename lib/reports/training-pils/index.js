const moment = require('moment');
const { trainingCoursePurpose } = require('@ukhomeoffice/asl-constants');

const formatDate = date => {
  return date ? moment(date).format('YYYY-MM-DD') : '';
};

module.exports = ({ db }) => {

  const query = () => {
    return db.asl('training_pils')
      .select('training_pils.*')
      .select('profiles.pil_licence_number AS licence_number')
      .select('establishments.name AS establishment')
      .select('training_courses.title AS course_title')
      .select('training_courses.course_purpose')
      .select('training_courses.start_date AS course_start_date')
      .select('training_courses.species AS course_species')
      .select('projects.title AS project_title')
      .select('projects.licence_number AS project_licence_number')
      .join('profiles', 'training_pils.profile_id', '=', 'profiles.id')
      .join('training_courses', 'training_pils.training_course_id', '=', 'training_courses.id')
      .join('establishments', 'training_courses.establishment_id', '=', 'establishments.id')
      .join('projects', 'training_courses.project_id', '=', 'projects.id')
      .whereIn('training_pils.status', ['active', 'revoked', 'expired']);
  };

  const parse = pil => {
    return {
      licence_number: pil.licence_number,
      status: pil.status,
      establishment: pil.establishment,
      course_title: pil.course_title,
      course_purpose: trainingCoursePurpose[pil.course_purpose],
      course_start_date: formatDate(pil.course_start_date),
      course_species: (pil.course_species || []).join(', '),
      project_title: pil.project_title,
      project_licence_number: pil.project_licence_number,
      pil_issue_date: formatDate(pil.issue_date),
      pil_revocation_date: formatDate(pil.revocation_date),
      pil_expiry_date: formatDate(pil.expiry_date),
      pil_last_amended: formatDate(pil.updated_at)
    };
  };

  return { query, parse };

};
