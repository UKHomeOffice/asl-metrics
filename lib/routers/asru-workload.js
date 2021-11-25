const { Router } = require('express');
const { intersection, values } = require('lodash');
const moment = require('moment');
const getWorkflowStatuses = require('../middleware/get-workflow-statuses');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.use(getWorkflowStatuses(settings));

  router.get('/', async (req, res, next) => {
    const { progress = 'open', start, end } = req.query;
    const openStatuses = req.flow.open;
    const closedStatuses = ['resolved', 'rejected', 'discarded-by-asru'];
    const withAsruStatuses = req.flow.withAsru;
    const notWithAsruStatuses = req.flow.notWithAsru;

    let taskCount = 0;
    let results = {};

    const asruUsers = await req.db.asl('profiles')
      .select(
        'id',
        'first_name AS firstName',
        'last_name AS lastName',
        'asru_inspector AS asruInspector',
        'asru_licensing AS asruLicensing'
      )
      .where({ asru_user: true });

    return new Promise((resolve, reject) => {
      let query;

      if (progress === 'closed') {
        query = req.db.flow('activity_log')
          .select([
            'case_id AS id',
            'changed_by AS assigned_to',
            req.db.flow.raw(`cases.data->>'status' AS status`),
            req.db.flow.raw(`cases.data->>'model' AS model`),
            req.db.flow.raw(`cases.data->'modelData'->>'status' AS model_status`)
          ])
          .join('cases', 'case_id', 'cases.id')
          .where(builder => {
            closedStatuses.map(status => {
              builder.orWhere('event_name', 'like', `%:${status}`);
            });
          })
          .whereBetween('activity_log.updated_at', [
            moment(start).startOf('day').toISOString(),
            moment(end).endOf('day').toISOString()
          ]);
      } else {
        query = req.db.flow('cases')
          .select([
            'id',
            'assigned_to',
            'status',
            req.db.flow.raw(`data->>'model' AS model`),
            req.db.flow.raw(`data->'modelData'->>'status' AS model_status`)
          ]);

        if (req.query.withAsru === 'yes') {
          query.whereIn('status', intersection(openStatuses, withAsruStatuses));
        } else if (req.query.withAsru === 'no') {
          query.whereIn('status', intersection(openStatuses, notWithAsruStatuses));
        } else {
          query.whereIn('status', openStatuses);
        }
      }

      return query.stream(taskStream => {
        taskStream.on('data', task => {
          taskCount++;

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
          .on('finish', resolve)
          .on('error', reject);
      }).catch(reject);
    })
      .then(() => {
        console.log(`Processed ${taskCount} tasks`);
        res.json(values(results));
      })
      .catch(next);
  });

  return router;
};
