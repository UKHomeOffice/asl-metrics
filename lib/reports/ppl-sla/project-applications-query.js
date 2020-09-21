const moment = require('moment-business-time');

module.exports = (db) => {

  const query = db.flow('cases')
    .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
    .select([
      'cases.*',
      db.flow.raw('JSON_AGG(activity_log.* ORDER BY activity_log.created_at asc) as activity')
    ])
    .whereRaw(`cases.data->>'model' = 'project'`)
    .whereRaw(`cases.data->>'action' = 'grant'`)
    .whereRaw(`cases.data->'modelData'->>'status' = 'inactive'`)
    // tasks less than 40 days old could not possibly exceeded the deadline yet, so ignore them
    .where('cases.created_at', '<', moment().subtract(40, 'days').format('YYYY-MM-DD'))
    .where(function () {
      // ignore comment-related activity
      this
        .where('activity_log.event_name', 'like', 'status:%')
        .orWhere('activity_log.event_name', '=', 'update');
    })
    .groupBy('cases.id');

  return query;

};
