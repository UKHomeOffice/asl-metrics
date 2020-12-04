const { bankHolidays } = require('@asl/constants');
const moment = require('moment-business-time');

// configure bank holidays
moment.updateLocale('en', { holidays: bankHolidays });

const formatTime = time => {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const days = Math.floor(time / day);
  const hours = Math.floor((time % day) / hour);
  const minutes = Math.floor((time % hour) / minute);
  return `${days}d${hours}h${minutes}m`;
};

module.exports = ({ db, query: params, flow }) => {

  const query = () => {
    return db.flow('cases')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.*) as activity')
      ])
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .whereRaw(`cases.data->>'model' = 'project'`)
      .whereRaw(`cases.data->>'action' = 'grant'`)
      .whereRaw(`cases.data->'modelData'->>'status' = 'inactive'`)
      .where('cases.status', 'resolved')
      .groupBy('cases.id');
  };

  const parse = record => {
    const activity = record.activity.filter(a => a.event_name.match(/^status:/));
    const timers = {
      total: 0,
      asru: 0,
      establishment: 0,
      inspector: 0,
      licensing: 0
    };
    let last = moment(record.created_at).valueOf();
    activity.forEach(log => {
      const diff = moment(log.created_at).valueOf() - last;
      const status = log.event_name.split(':')[1];
      if (flow[status].withASRU) {
        timers.asru += diff;
      } else {
        timers.establishment += diff;
      }
      if (['with-inspectorate', 'referred-to-inspector'].includes(status)) {
        timers.inspector += diff;
      }
      if (['with-licensinf', 'inspector-recommended', 'inspector-rejected'].includes(status)) {
        timers.licensing += diff;
      }
      timers.total += diff;
      last = moment(record.created_at).valueOf();
    });

    return db.asl('projects')
      .select(
        'projects.*',
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
          licenceNumber: project.licence_number,
          licenceHolder: `${project.first_name} ${project.last_name}`,
          submitted: moment(record.created_at).format('YYYY-MM-DD'),
          totalTime: formatTime(timers.total),
          timeWithEstablishment: formatTime(timers.establishment),
          timeWithInspector: formatTime(timers.inspector),
          timeWithLicensing: formatTime(timers.licensing),
          timeWithASRU: formatTime(timers.asru),
          timeWithASRUPercentage: `${Math.round(100 * (timers.asru / timers.total))}%`
        };
      });

  };

  return { query, parse };

};
