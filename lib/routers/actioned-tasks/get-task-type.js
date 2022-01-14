const { get } = require('lodash');

module.exports = task => {
  const model = get(task, 'data.model');
  const action = get(task, 'data.action');
  const isApplication = get(task, 'data.modelData.status') === 'inactive';

  switch (model) {
    case 'establishment':
      return 'pel';

    case 'trainingPil':
      return 'trainingPil';

    case 'pil':
      return action === 'revoke'
        ? 'pilRevocation'
        : (isApplication ? 'pilApplication' : 'pilAmendment');

    case 'project':
      return action === 'grant-ra'
        ? 'ra'
        : (isApplication ? 'pplApplication' : 'pplAmendment'); // pplAmendment includes transfer & revoke

    default:
      return 'other';
  }
};
