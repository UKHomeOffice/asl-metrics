const { Router } = require('express');
const { without, intersection, values } = require('lodash');
const moment = require('moment');
const getWorkflowStatuses = require('../middleware/get-workflow-statuses');

module.exports = settings => {
  const router = Router({ mergeParams: true });

  router.use(getWorkflowStatuses(settings));

  router.get('/', async (req, res, next) => {
    const { progress = 'open', start, end } = req.query;
    const openStatuses = req.flow.open;
    const closedStatuses = without(req.flow.closed, 'autoresolved');
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
      const query = req.db.flow('cases')
        .select([
          'id',
          'status',
          'assigned_to AS assignedTo',
          req.db.flow.raw(`data->>'model' AS model`),
          req.db.flow.raw(`data->'modelData'->>'status' AS modelStatus`)
        ]);

      if (progress === 'closed') {
        query.whereIn('status', closedStatuses)
          .whereBetween('updated_at', [
            moment(start).startOf('day').toISOString(),
            moment(end).endOf('day').toISOString()
          ]);
      } else {
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

          console.log(task);

          const assignedTo = asruUsers.find(p => p.id === task.assignedTo) || { id: 'unassigned' };
          const model = task.model;
          const isApplication = task.modelStatus === 'inactive';

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
        console.log(results);
        console.log(`Processed ${taskCount} tasks`);
        res.json(values(results));
      })
      .catch(next);
  });

  return router;
};
