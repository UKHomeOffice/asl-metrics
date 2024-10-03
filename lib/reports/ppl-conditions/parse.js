const { omit, get, concat, pick } = require('lodash');
const moment = require('moment');
const CONDITIONS_SPEC = require('@asl/projects/client/constants/conditions').default;
const RA = require('@asl/projects/client/constants/retrospective-assessment').default;

const categoriseCondition = (condition, level, protocolTitle = '') => {
  return {
    level,
    protocol_name: protocolTitle,
    ...condition
  };
};

const mergeProjectAndProtocolConditions = project => {
  const projectConditions = (project.conditions || []).map(c => categoriseCondition(c, 'project'));

  const protocolConditions =
      (project.protocols || [])
        .flatMap(p => (p.conditions || []).map(c => categoriseCondition(c, 'protocol', p.title)));

  return concat(projectConditions, protocolConditions);
};

function projectToConditions(project) {
  const row = {
    establishment: project.name,
    ...pick(project, 'licence_number', 'title', 'status', 'schema_version'),
    issue_date: moment(project.issue_date).format('YYYY-MM-DD'),
    conditions: project.data.conditions || [],
    protocols: (project.data.protocols || []).map(protocol => pick(protocol, ['title', 'conditions']))
  };

  const allConditions = mergeProjectAndProtocolConditions(row);

  if (allConditions.length) {
    return allConditions.map(condition => {
      return {
        ...omit(row, 'conditions', 'protocols'),
        ...omit(condition, 'title'), // Title clashes with project title
        conditionTitle: condition.title
      };
    });
  } else {
    return [omit(row, 'conditions', 'protocols')];
  }
}

const EMPTY_CONDITION_ROW = {
  level: '',
  protocol_name: '',
  type: '',
  condition: 'none',
  requires_editing: '',
  edited: '',
  content: ''
};

function getConditionLabel(isRA, isCustom, condition, defaultCondition) {
  if (isRA) { return 'Retrospective assessment'; }
  if (isCustom) { return 'CUSTOM'; }
  if (defaultCondition.title) { return defaultCondition.title; }

  return condition.conditionTitle;
}

const conditionToReportRow = condition => {
  // A project without conditions
  if (!condition.key) {
    return {
      ...condition,
      ...EMPTY_CONDITION_ROW
    };
  }

  const defaultCondition = get(CONDITIONS_SPEC[condition.level], condition.path) || {};
  const isCustom = condition.custom || condition.key === 'custom';
  const isRA = condition.key === 'retrospective-assessment';

  const requiresEditing = isCustom || isRA ? false : ((defaultCondition.requiresEditing && !condition.edited) || false);

  return {
    ...pick(condition, 'establishment', 'licence_number', 'title', 'status', 'schema_version', 'issue_date', 'level', 'protocol_name', 'type'),
    condition: getConditionLabel(isRA, isCustom, condition, defaultCondition),
    requires_editing: requiresEditing ? 'true' : 'false',
    edited: condition.edited || '',
    content: isRA ? RA.required : (condition.content || defaultCondition.content)
  };
};

const parse = project => {
  return projectToConditions(project).map(conditionToReportRow);
};

module.exports = parse;
