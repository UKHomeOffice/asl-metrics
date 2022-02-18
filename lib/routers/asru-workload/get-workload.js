const { intersection, values } = require('lodash');
const moment = require('moment');

const getAsruUsers = db => {
  return db.asl('profiles')
    .select(
      'id',
      'first_name AS firstName',
      'last_name AS lastName',
      'asru_inspector AS asruInspector',
      'asru_licensing AS asruLicensing'
    )
    .where({ asru_user: true });
};

module.exports = async ({ db, flow, progress, withAsru, start, end }) => {
  const openStatuses = flow.open;
  const closedStatuses = ['resolved', 'rejected', 'discarded-by-asru'];
  const withAsruStatuses = flow.withAsru;
  const notWithAsruStatuses = flow.notWithAsru;

  let results = {};

  const asruUsers = await getAsruUsers(db);

  return new Promise((resolve, reject) => {
    let query;

    if (progress === 'closed') {
      query = db.flow('cases')
        .select([
          'cases.id AS id',
          'activity_log.changed_by AS assigned_to',
          'cases.status AS status',
          db.flow.raw(`data->>'model' AS model`),
          db.flow.raw(`data->'modelData'->>'status' AS model_status`)
        ])
        .whereIn('cases.status', closedStatuses)
        .join(
          // find the activity that closed the task
          db.flow('activity_log')
            .select('changed_by', 'case_id')
            .where(builder => {
              closedStatuses.map(status => {
                builder.orWhere('activity_log.event_name', '~', `:${status}$`);
              });
            })
            .orderBy('activity_log.updated_at')
            .as('activity_log'),
          'cases.id',
          'activity_log.case_id'
        )
        .whereBetween('cases.updated_at', [
          moment(start).startOf('day').toISOString(),
          moment(end).endOf('day').toISOString()
        ]);
    } else if (progress === 'returned') {
      query = db.flow('activity_log')
        .select([
          'changed_by AS assigned_to',
          db.flow.raw(`event->'data'->>'model' AS model`),
          db.flow.raw(`event->'data'->'modelData'->>'status' AS model_status`)
        ])
        .where('event_name', '~', `:returned-to-applicant$`)
        .orderBy('updated_at')
        .whereBetween('updated_at', [
          moment(start).startOf('day').toISOString(),
          moment(end).endOf('day').toISOString()
        ]);
    } else if (progress === 'open') {
      query = db.flow('cases')
        .select([
          'id',
          'assigned_to',
          'status',
          db.flow.raw(`data->>'model' AS model`),
          db.flow.raw(`data->'modelData'->>'status' AS model_status`)
        ]);

      if (withAsru === 'yes') {
        query.whereIn('status', intersection(openStatuses, withAsruStatuses));
      } else if (withAsru === 'no') {
        query.whereIn('status', intersection(openStatuses, notWithAsruStatuses));
      } else {
        query.whereIn('status', openStatuses);
      }
    }

    return query.stream(taskStream => {
      taskStream.on('data', task => {
        const assignedTo = asruUsers.find(p => p.id === task.assigned_to) || { id: 'unassigned' };
        const model = task.model;
        const isApplication = task.model_status === 'inactive';

        results[assignedTo.id] = {
          ...{ assignedTo, total: 0, pplApplications: 0, pplAmendments: 0, pils: 0, pels: 0, profiles: 0 },
          ...results[assignedTo.id]
        };

        results[assignedTo.id].total++;

        if (['project', 'rop'].includes(model)) {
          if (isApplication) {
            results[assignedTo.id].pplApplications++;
          } else {
            results[assignedTo.id].pplAmendments++;
          }
        } else if (['pil', 'trainingPil'].includes(model)) {
          results[assignedTo.id].pils++;
        } else if (['establishment', 'place', 'role'].includes(model)) {
          results[assignedTo.id].pels++;
        } else if (model === 'profile') {
          results[assignedTo.id].profiles++;
        }
      })
        .on('finish', () => {
          resolve(values(results));
        })
        .on('error', reject);
    }).catch(reject);
  });
};
