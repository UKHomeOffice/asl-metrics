const { get } = require('lodash');

const moment = require('moment-business-time');
const { bankHolidays } = require('@ukhomeoffice/asl-constants');
moment.updateLocale('en', { holidays: bankHolidays });

const LONGEST_DEADLINE = 55;
const SHORTEST_DEADLINE = 15;

const targetClearingStatuses = [
  'recalled-by-applicant',
  'returned-to-applicant'
];

const closedStatuses = [
  'resolved',
  'rejected',
  'withdrawn-by-applicant',
  'discarded-by-asru'
];

function yesNo(v) {
  return v ? 'Yes' : 'No';
}

module.exports = ({ db, query: params }) => {

  if (!params.start || moment(params.start).format('YYYY-MM-DD') !== params.start) {
    throw Error('valid start date must be provided');
  }

  if (!params.end || moment(params.end).format('YYYY-MM-DD') !== params.end) {
    throw Error('valid end date must be provided');
  }

  // if the task was last updated more than 55 days before our start date (longest deadline)
  // or created after 15 days before the end date (shortest deadline)
  // then it cannot have passed the deadline during the requested report period and therefore we can safely ignore it
  const earliest = moment(params.start).subtractWorkingTime(LONGEST_DEADLINE, 'days').format('YYYY-MM-DD');
  const latest = moment(params.end).subtractWorkingTime(SHORTEST_DEADLINE, 'days').format('YYYY-MM-DD');

  const query = () => {
    const q = db.flow('cases')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.* ORDER BY activity_log.created_at) as activity')
      ])
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .whereRaw(`cases.data->>'model' = 'project'`)
      .whereRaw(`cases.data->>'action' = 'grant'`)
      .where('cases.updated_at', '>', earliest)
      .where('cases.created_at', '<=', latest)
      .where(orBuilder => {
        const statuses = [...targetClearingStatuses, ...closedStatuses];
        const statusPlaceholders = statuses.map(_ => '?').join(',');
        return orBuilder
          .where(withinDateBuilder => {
            withinDateBuilder
              .where('activity_log.updated_at', '>', earliest)
              .where('activity_log.created_at', '<=', latest);
          })
          .orWhere(statusBuilder => {
            statusBuilder
              .whereRaw(`activity_log.event->>'status' in (${statusPlaceholders})`, statuses);
          });
      })
      .where(builder =>
        builder
          .where('activity_log.event_name', '=', 'update')
          .orWhere('activity_log.event_name', 'like', 'status:%')
      )
      .groupBy('cases.id');

    return q;
  };

  const parse = record => {
    const amendment = get(record, 'data.modelData.status') !== 'inactive';
    let target;
    let targetExceeded = true; // we will know from activity log if/when it's resolved / returned
    let resolvedAt;
    let resubmitted;
    let extended;

    record.activity
      .forEach(activity => {
        if (!target) {
          const internalDeadline = get(activity, 'event.data.internalDeadline');
          extended = get(activity, 'event.data.deadline.isExtended') === true;

          if (internalDeadline) {
            target = amendment
              ? internalDeadline.standard
              : (extended ? internalDeadline.extended : internalDeadline.standard);

            if (target < params.start || target > params.end) {
              target = undefined; // target falls outside of reporting period, ignore it
            }

            return; // deadline was found, move on to next activity
          }

          return; // skip any activity before internal deadline is set
        }

        const activityDate = moment(activity.updated_at).format('YYYY-MM-DD');
        resubmitted = get(activity, 'event.data.internalDeadline.resubmitted');

        if (targetClearingStatuses.includes(activity.event.status) && activityDate <= target) {
          target = undefined;
        }

        if (closedStatuses.includes(activity.event.status)) {
          resolvedAt = activity.updated_at;
          targetExceeded = activityDate > target;
        }
      });

    if (!target || !targetExceeded) {
      return null; // no internal deadline found, or it was not exceeded, so ignore this task
    }

    return {
      task_id: record.id,
      project_title: get(record, 'data.modelData.title'),
      licence_number: get(record, 'data.modelData.licenceNumber'),
      type: amendment ? 'amendment' : 'application',
      resubmitted: yesNo(resubmitted),
      extended: yesNo(extended),
      still_open: yesNo(!resolvedAt),
      target,
      resolved_at: resolvedAt
    };
  };

  return { query, parse };

};
