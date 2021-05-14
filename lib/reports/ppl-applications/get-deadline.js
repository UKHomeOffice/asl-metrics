const { get } = require('lodash');

const isDeadlineExtension = activity => {
  if (activity.event_name !== 'update') {
    return false;
  }
  const extensionFlag = 'event.meta.payload.data.deadline.isExtended';
  const bcExtensionFlag = 'event.meta.payload.data.extended';
  return get(activity, extensionFlag) || get(activity, bcExtensionFlag, false);
};

module.exports = task => {
  let deadline = get(task, 'data.deadline');
  const isExtended = (deadline && deadline.isExtended) || get(task, 'data.extended', false); // old location of extended flag for BC
  deadline = { isExtended };

  if (deadline.isExtended) {
    deadline.extendedReason = task.activity.reduce((reason, activity) => {
      if (!reason && isDeadlineExtension(activity)) {
        reason = activity.comment;
      }
      return reason;
    }, '');
  }

  return deadline;
};
