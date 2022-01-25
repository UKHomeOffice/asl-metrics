const { get, pick } = require('lodash');
const moment = require('moment-business-time');
const { bankHolidays } = require('@asl/constants');
moment.updateLocale('en', { holidays: bankHolidays });

const getTaskType = require('./get-task-type');

module.exports = ({ db, flow, logger, query: params }) => {

  if (!params.start || moment(params.start).format('YYYY-MM-DD') !== params.start) {
    throw Error('valid start date must be provided');
  }

  if (!params.end || moment(params.end).format('YYYY-MM-DD') !== params.end) {
    throw Error('valid end date must be provided');
  }

  const start = moment(params.start).startOf('day');
  const end = moment(params.end).endOf('day');

  const openStatuses = flow.open;
  const closedStatuses = flow.closed;
  const withAsruStatuses = flow.withAsru;

  const query = () => {
    const q = db.flow('cases')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.*) as activity')
      ])
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .where('cases.status', '!=', 'autoresolved')
      .where('cases.created_at', '<=', end.toISOString()) // ignore tasks created after report period
      .where(builder => {
        // ignore tasks closed before the report period
        builder.whereIn('cases.status', openStatuses)
          .orWhere(b => {
            b.whereIn('cases.status', closedStatuses)
              .andWhere('cases.updated_at', '>=', start.toISOString());
          });
      })
      .groupBy('cases.id');

    return q;
  };

  const parse = task => {
    const taskType = getTaskType(task);

    if (taskType === 'other') {
      return null;
    }

    let firstSubmittedAt;
    let firstAssignedAt;
    let firstReturnedAt;
    let resolvedAt;
    let returnedCount = 0;
    let wasSubmitted = false;
    let isOutstanding = false;
    let submitToActionDiff;
    let assignToActionDiff;

    task.activity
      .sort((a, b) => a.created_at < b.created_at ? -1 : 1) // ascending time order
      .forEach(a => {
        const eventTime = moment(a.created_at);
        const eventStatus = get(a, 'event.status');

        if (withAsruStatuses.includes(eventStatus)) {
          if (!firstSubmittedAt) {
            firstSubmittedAt = moment(eventTime);
          }
          if (eventTime.isBefore(end)) {
            isOutstanding = true;
          }
        } else if (eventTime.isBefore(end)) {
          isOutstanding = false;
        }

        if (!firstAssignedAt && a.event_name === 'assign') {
          firstAssignedAt = moment(eventTime);
          return;
        }

        if (eventTime.isAfter(start) && eventTime.isBefore(end)) {
          // we only care about closed or returned inside the time period
          if (/:returned-to-applicant$/.test(a.event_name) && !a.event_name.includes('awaiting-endorsement')) {
            if (!firstReturnedAt) {
              firstReturnedAt = moment(eventTime);
              returnedCount++;
            }
          }
          if (/:resolved$/.test(a.event_name)) {
            resolvedAt = moment(eventTime);
          }
          if (/:rejected$/.test(a.event_name)) {
            resolvedAt = moment(eventTime);
          }
        }
      });

    if (!firstSubmittedAt) {
      return null; // task was never with ASRU, ignore
    }

    if (firstSubmittedAt.isAfter(start) && firstSubmittedAt.isBefore(end)) {
      wasSubmitted = true;
    }

    if (firstReturnedAt) {
      submitToActionDiff = firstReturnedAt.workingDiff(firstSubmittedAt, 'calendarDays');
      if (firstAssignedAt) {
        assignToActionDiff = firstReturnedAt.workingDiff(firstAssignedAt, 'calendarDays');
      }
    } else if (resolvedAt) {
      submitToActionDiff = resolvedAt.workingDiff(firstSubmittedAt, 'calendarDays');
      if (firstAssignedAt) {
        assignToActionDiff = resolvedAt.workingDiff(firstAssignedAt, 'calendarDays');
      }
    }

    return {
      ...pick(task, ['id', 'type', 'status', 'data.model', 'data.action']),
      metrics: {
        taskType,
        firstSubmittedAt: firstSubmittedAt && firstSubmittedAt.toISOString(),
        firstReturnedAt: firstReturnedAt && firstReturnedAt.toISOString(),
        firstAssignedAt: firstAssignedAt && firstAssignedAt.toISOString(),
        resolvedAt: resolvedAt && resolvedAt.toISOString(),
        assignToActionDiff,
        submitToActionDiff,
        wasSubmitted,
        isOutstanding,
        returnedCount
      }
    };
  };

  return { query, parse };
};
