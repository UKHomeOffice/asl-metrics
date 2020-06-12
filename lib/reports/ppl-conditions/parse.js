const { omit, concat, flatten, pick } = require('lodash');
const moment = require('moment');

const getCondition = (condition, level, protocolTitle = '') => {
  return {
    level,
    protocol_name: protocolTitle,
    ...condition
  };
};

const getAllConditions = project => {
  const projectConditions = (project.conditions || []).map(c => getCondition(c, 'project'));

  const protocolConditions = (project.protocols || []).map(p => {
    return (p.conditions || []).map(c => getCondition(c, 'protocol', p.title));
  });

  return concat(projectConditions, flatten(protocolConditions));
};

const parse = project => {

  const row = {
    establishment: project.name,
    ...pick(project, 'licence_number', 'title', 'status', 'schema_version'),
    issue_date: moment(project.issue_date).format('YYYY-MM-DD'),
    conditions: project.data.conditions || [],
    protocols: (project.data.protocols || []).map(protocol => pick(protocol, ['title', 'conditions']))
  };

  const allConditions = getAllConditions(row);

  if (allConditions.length) {
    return allConditions.map(condition => {
      return {
        ...omit(row, 'conditions', 'protocols'),
        ...condition
      };
    });
  } else {
    return omit(row, 'conditions', 'protocols');
  }
};

module.exports = parse;
