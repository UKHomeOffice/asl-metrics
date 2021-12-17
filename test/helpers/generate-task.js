const { v4: uuid } = require('uuid');
const { omit } = require('lodash');

const moment = require('moment-business-time');
const { bankHolidays } = require('@asl/constants');
moment.updateLocale('en', { holidays: bankHolidays });

const generateTask = ({
  model = 'project',
  action = 'grant',
  type = 'application',
  deadline,
  internalDeadline,
  createdAt = '2021-12-01'
}) => {
  const id = uuid();
  createdAt = moment(createdAt).toISOString();

  const task = {
    id,
    data: {
      action,
      model,
      modelData: {
        title: `${model} ${type} ${action} ${id}`,
        licenceNumber: `XX-${id}`,
        status: type === 'application' ? 'inactive' : 'active'
      },
      deadline,
      internalDeadline
    },
    status: 'new',
    created_at: createdAt,
    updated_at: createdAt,
    activity: [
      { id: uuid(), case_id: id, event_name: 'create', event: { status: 'new' }, created_at: createdAt, updated_at: createdAt }
    ],
    history: function(status, daysOffset = 1) {
      const previousStatus = this.status;
      this.status = status;
      this.updated_at = moment(this.updated_at).addWorkingTime(daysOffset, 'days').toISOString();
      const event = omit(this, 'activity');

      this.activity.unshift({
        id: uuid(),
        event_name: `status:${previousStatus}:${status}`,
        event,
        created_at: this.updated_at,
        updated_at: this.updated_at
      });
    }
  };

  return task;
};

module.exports = generateTask;
