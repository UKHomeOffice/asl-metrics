const moment = require('moment');
const isUUID = require('uuid-validate');
const { get, flatten } = require('lodash');
const { default: projectConditions } = require('@asl/projects/client/constants/conditions');

module.exports = ({ db }) => {

  const query = () => {
    const establishmentReminders = db.asl('reminders')
      .select([
        'reminders.*',
        'establishments.id AS establishment_id',
        'establishments.name AS establishment_name',
        'establishments.licence_number AS licence_number',
        'profiles.id AS licence_holder_id',
        db.asl.raw(`concat_ws(' ', profiles.first_name, profiles.last_name) AS licence_holder_name`),
        'establishments.conditions AS conditions',
        db.asl.raw(`'{}'::jsonb AS version_data`) // dummy column (need same cols for UNION ALL)
      ])
      .join('establishments', 'reminders.establishment_id', 'establishments.id')
      .leftJoin('roles', builder => {
        builder
          .on('establishments.id', '=', 'roles.establishment_id')
          .andOn(qb => {
            qb.onVal('roles.type', '=', 'pelh')
              .orOnVal('roles.type', '=', 'nprc');
          });
      })
      .leftJoin('profiles', 'profiles.id', 'roles.profile_id')
      .where('reminders.status', 'active')
      .whereNull('reminders.deleted')
      .where('model_type', 'establishment');

    const pilReminders = db.asl('reminders')
      .select([
        'reminders.*',
        'establishments.id AS establishment_id',
        'establishments.name AS establishment_name',
        'profiles.pil_licence_number AS licence_number',
        'profiles.id AS licence_holder_id',
        db.asl.raw(`concat_ws(' ', profiles.first_name, profiles.last_name) AS licence_holder_name`),
        'pils.conditions AS conditions',
        db.asl.raw(`'{}'::jsonb AS version_data`) // dummy column (need same cols for UNION ALL)
      ])
      .join('establishments', 'reminders.establishment_id', 'establishments.id')
      .join(db.asl.raw('"pils" ON "reminders"."model_id"::uuid = "pils"."id"')) // prevent operator does not exist error
      .join('profiles', 'profiles.id', 'pils.profile_id')
      .where('reminders.status', 'active')
      .whereNull('reminders.deleted')
      .where('model_type', 'pil');

    const projectReminders = db.asl('reminders')
      .select([
        'reminders.*',
        'establishments.id AS establishment_id',
        'establishments.name AS establishment_name',
        'projects.licence_number AS licence_number',
        'profiles.id AS licence_holder_id',
        db.asl.raw(`concat_ws(' ', profiles.first_name, profiles.last_name) AS licence_holder_name`),
        db.asl.raw(`'' AS conditions`),
        db.asl('project_versions')
          .select('project_versions.data')
          .where('project_versions.project_id', db.asl.raw('projects.id'))
          .where('project_versions.status', 'granted')
          .orderBy('project_versions.updated_at', 'desc')
          .first()
          .as('version_data')
      ])
      .join('establishments', 'reminders.establishment_id', 'establishments.id')
      .join(db.asl.raw('"projects" ON "reminders"."model_id"::uuid = "projects"."id"')) // prevent operator does not exist error
      .join('profiles', 'profiles.id', 'projects.licence_holder_id')
      .where('reminders.status', 'active')
      .whereNull('reminders.deleted')
      .where('model_type', 'project');

    const wrapSubqueries = true; // need to wrap in parentheses or the unionAll doesn't work

    const q = db.asl
      .unionAll([establishmentReminders, pilReminders, projectReminders], wrapSubqueries)
      .orderBy('deadline', 'desc');

    return q;
  };

  const parse = async record => {
    return {
      licence_number: record.licence_number,
      licence_type: record.model_type,
      licence_holder_name: record.licence_holder_name,
      establishment_id: record.establishment_id,
      establishment_name: record.establishment_name,
      ...getConditions(record),
      deadline: moment(record.deadline).format('YYYY-MM-DD')
    };
  };

  const getConditions = record => {
    if (['establishment', 'pil'].includes(record.model_type)) {
      return { condition_type: 'custom', condition_content: record.conditions };
    }

    let condition;

    if (isUUID(record.condition_key)) {
      condition = flatten(record.version_data.protocols.map(p => p.conditions || []))
        .find(c => c.key === record.condition_key);

      return {
        condition_type: 'protocol',
        condition_content: condition.edited || ''
      };
    }

    condition = record.version_data.conditions && record.version_data.conditions.find(c => c.key === record.condition_key);

    return {
      condition_type: condition.type ? `${condition.type}: ${condition.key}` : 'legacy',
      condition_content: getConditionContent(condition)
    };
  };

  const getConditionContent = condition => {
    if (!condition) {
      return '';
    }

    if (condition.edited) {
      return condition.edited;
    }

    const versionNumber = condition.path ? condition.path.split('.').pop() : 0;
    const conditionVersion = get(projectConditions, `project[${condition.key}].versions[${versionNumber}]`);

    return conditionVersion ? conditionVersion.content : '';
  };

  return { query, parse };
};
