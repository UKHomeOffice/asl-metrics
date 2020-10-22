const { bankHolidays } = require('@asl/constants');
const { get } = require('lodash');
const moment = require('moment-business-time');

// configure bank holidays
moment.updateLocale('en', { holidays: bankHolidays });

module.exports = ({ db, query: params, flow }) => {

  const since = (params && params.since) ? moment(params.since, 'YYYY-MM-DD').format('YYYY-MM-DD') : null;

  const query = () => {
    return db.flow('cases')
      .whereRaw(`(cases.data->>'deadlinePassed')::boolean = true`)
      .whereRaw(`cases.data->'deadline'->'exemption'->>'isExempt' is null`)
      .whereRaw(`cases.data->>'model' = 'project'`)
      .whereRaw(`cases.data->>'action' = 'grant'`)
      .whereRaw(`cases.data->'modelData'->>'status' = 'inactive'`)
      .where(function () {
        since && this
          .whereRaw(`cases.data->>'deadlinePassedDate' is not null`)
          .whereRaw(`(cases.data->>'deadlinePassedDate')::date > '${since}'`);
      });
  };

  const parse = record => {
    const deadline = get(record, 'data.deadlinePassedDate');
    const extended = !!get(record, 'data.deadline.isExtended', false);
    return db.asl('projects')
      .select(
        'projects.title',
        'establishments.name',
        'profiles.first_name',
        'profiles.last_name'
      )
      .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
      .leftJoin('profiles', 'projects.licence_holder_id', 'profiles.id')
      .where({ 'projects.id': record.data.id })
      .first()
      .then(project => {
        return {
          title: project.title,
          establishment: project.name,
          licence_holder: `${project.first_name} ${project.last_name}`,
          submitted: moment(deadline).subtractWorkingTime(extended ? 55 : 40, 'days').format('YYYY-MM-DD'),
          deadline,
          extended,
          task: record.id
        };
      });

  };

  return { query, parse };

};
