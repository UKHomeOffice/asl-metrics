const { get } = require('lodash');

module.exports = task => {
  const model = get(task, 'data.model');
  const action = get(task, 'data.action');
  const isApplication = get(task, 'data.modelData.status') !== 'active';

  switch (model) {
    case 'establishment':
    case 'place':
    case 'role':
      return 'pel';

    case 'trainingPil':
      return 'trainingPil';

    case 'pil':
      if (action === 'revoke') {
        return 'pilRevocation';
      }
      if (action === 'grant') {
        return (isApplication ? 'pilApplication' : 'pilAmendment');
      }
      break;

    case 'project':
      return action === 'grant-ra'
        ? 'ra'
        : (isApplication ? 'pplApplication' : 'pplAmendment'); // pplAmendment includes transfer & revoke
  }

  return 'other';
};
