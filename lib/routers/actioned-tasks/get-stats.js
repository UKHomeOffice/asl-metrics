const moment = require('moment-business-time');
const { bankHolidays } = require('@asl/constants');
moment.updateLocale('en', { holidays: bankHolidays });

const { get, cloneDeep, mean, round } = require('lodash');
const getTaskType = require('./get-task-type');

const calcAverageTimes = results => {
  Object.keys(results).forEach(taskType => {
    results[taskType].submitToActionDays = results[taskType].submitToActionDays.length > 0
      ? round(mean(results[taskType].submitToActionDays))
      : '-';

    results[taskType].assignToActionDays = results[taskType].assignToActionDays.length > 0
      ? round(mean(results[taskType].assignToActionDays))
      : '-';
  });

  return results;
};

module.exports = async ({ db, flow, start, end, logger }) => {
  if (!start || moment(start).format('YYYY-MM-DD') !== start) {
    throw Error('valid start date must be provided');
  }

  if (!end || moment(end).format('YYYY-MM-DD') !== end) {
    throw Error('valid end date must be provided');
  }

  start = moment(start).startOf('day');
  end = moment(end).endOf('day');

  const openStatuses = flow.open;
  const closedStatuses = flow.closed;
  const withAsruStatuses = flow.withAsru;

  const stats = {
    submitted: 0,
    returned: 0,
    approved: 0,
    rejected: 0,
    outstanding: 0,
    submitToActionDays: [],
    assignToActionDays: []
  };

  let results = {
    pplApplication: cloneDeep(stats),
    pplAmendment: cloneDeep(stats),
    ra: cloneDeep(stats),
    pel: cloneDeep(stats),
    pilApplication: cloneDeep(stats),
    pilAmendment: cloneDeep(stats),
    pilRevocation: cloneDeep(stats),
    trainingPil: cloneDeep(stats)
  };

  return new Promise((resolve, reject) => {
    const query = db.flow('cases')
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

    return query.stream(taskStream => {
      taskStream.on('data', task => {
        const taskType = getTaskType(task);

        if (taskType === 'other') {
          return;
        }

        let firstSubmittedAt;
        let firstAssignedAt;
        let firstReturnedAt;
        let resolvedAt;
        let returnedCount = 0;
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
                }
                returnedCount++;
              }
              if (/:resolved$/.test(a.event_name)) {
                resolvedAt = moment(eventTime);
                results[taskType].approved++;
              }
              if (/:rejected$/.test(a.event_name)) {
                resolvedAt = moment(eventTime);
                results[taskType].rejected++;
              }
            }
          });

        if (firstSubmittedAt && firstSubmittedAt.isAfter(start) && firstSubmittedAt.isBefore(end)) {
          results[taskType].submitted++;
        }

        results[taskType].returned += returnedCount;
        results[taskType].outstanding += isOutstanding ? 1 : 0;

        if (firstReturnedAt) {
          submitToActionDiff = firstReturnedAt.workingDiff(firstSubmittedAt, 'calendarDays');
          results[taskType].submitToActionDays.push(submitToActionDiff);
          if (firstAssignedAt) {
            assignToActionDiff = firstReturnedAt.workingDiff(firstAssignedAt, 'calendarDays');
            results[taskType].assignToActionDays.push(assignToActionDiff);
          }
        } else if (resolvedAt) {
          submitToActionDiff = resolvedAt.workingDiff(firstSubmittedAt, 'calendarDays');
          results[taskType].submitToActionDays.push(submitToActionDiff);
          if (firstAssignedAt) {
            assignToActionDiff = resolvedAt.workingDiff(firstAssignedAt, 'calendarDays');
            results[taskType].assignToActionDays.push(assignToActionDiff);
          }
        }

        logger.debug({
          taskId: task.id,
          taskType,
          taskStatus: task.status,
          firstSubmittedAt: firstSubmittedAt && firstSubmittedAt.toISOString(),
          firstReturnedAt: firstReturnedAt && firstReturnedAt.toISOString(),
          firstAssignedAt: firstAssignedAt && firstAssignedAt.toISOString(),
          resolvedAt: resolvedAt && resolvedAt.toISOString(),
          assignToActionDiff,
          submitToActionDiff
        });
      })
        .on('finish', () => {
          results = calcAverageTimes(results);
          resolve(results);
        })
        .on('error', reject);
    }).catch(reject);
  });

};
