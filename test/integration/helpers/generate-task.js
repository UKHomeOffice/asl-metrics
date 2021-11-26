const { v4: uuid } = require('uuid');

module.exports = (type, status = 'new', assignedTo, id) => {
  const task = {
    id: id || uuid(),
    status,
    assigned_to: assignedTo
  };

  switch (type) {
    case 'pplApplication':
      task.data = { model: 'project', modelData: { status: 'inactive' } };
      break;

    case 'pplAmendment':
      task.data = { model: 'project', modelData: { status: 'active' } };
      break;

    case 'ropApplication':
      task.data = { model: 'rop', modelData: { status: 'inactive' } };
      break;

    case 'pil':
      task.data = { model: 'pil' };
      break;

    case 'trainingPil':
      task.data = { model: 'trainingPil' };
      break;

    case 'establishment':
      task.data = { model: 'establishment' };
      break;

    case 'place':
      task.data = { model: 'place' };
      break;

    case 'role':
      task.data = { model: 'role' };
      break;

    case 'profile':
      task.data = { model: 'profile' };
      break;
  }

  return task;
};
