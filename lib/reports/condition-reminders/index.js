const moment = require('moment');
const { get } = require('lodash');

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
        db.asl.raw(`to_jsonb(establishments.conditions) AS conditions`)
      ])
      .leftJoin('establishments', 'reminders.establishment_id', 'establishments.id')
      .leftJoin('roles', builder => {
        builder
          .on('establishments.id', '=', 'roles.establishment_id')
          .andOn(qb => {
            qb.onVal('roles.type', '=', 'pelh')
              .orOnVal('roles.type', '=', 'nprc');
          });
      })
      .leftJoin('profiles', 'profiles.id', 'roles.profile_id')
      .where('model_type', 'establishment');

    const pilReminders = db.asl('reminders')
      .select([
        'reminders.*',
        'establishments.id AS establishment_id',
        'establishments.name AS establishment_name',
        'profiles.pil_licence_number AS licence_number',
        'profiles.id AS licence_holder_id',
        db.asl.raw(`concat_ws(' ', profiles.first_name, profiles.last_name) AS licence_holder_name`),
        db.asl.raw(`to_jsonb(pils.conditions) AS conditions`)
      ])
      .leftJoin('establishments', 'reminders.establishment_id', 'establishments.id')
      // prevent "operator does not exist: character varying = uuid" error
      .leftJoin(db.asl.raw('"pils" ON "reminders"."model_id"::uuid = "pils"."id"'))
      .leftJoin('profiles', 'profiles.id', 'pils.profile_id')
      .where('model_type', 'pil');

    const projectReminders = db.asl('reminders')
      .select([
        'reminders.*',
        'establishments.id AS establishment_id',
        'establishments.name AS establishment_name',
        'projects.licence_number AS licence_number',
        'profiles.id AS licence_holder_id',
        db.asl.raw(`concat_ws(' ', profiles.first_name, profiles.last_name) AS licence_holder_name`),
        db.asl.raw(`project_versions.data->'conditions' AS conditions`)
      ])
      .leftJoin('establishments', 'reminders.establishment_id', 'establishments.id')
      // prevent "operator does not exist: character varying = uuid" error
      .leftJoin(db.asl.raw('"projects" ON "reminders"."model_id"::uuid = "projects"."id"'))
      .leftJoin('project_versions', 'project_versions.project_id', 'projects.id')
      .leftJoin('profiles', 'profiles.id', 'projects.licence_holder_id')
      .where('model_type', 'project');

    const q = db.asl
      .unionAll([establishmentReminders, pilReminders, projectReminders], true)
      .orderBy('deadline', 'desc');

    console.log(q.toString());
    return q;
  };

  const parse = async record => {
    const { default:projectConditions } = await import('@asl/projects/client/constants/conditions.js');

    return {
      licence_number: record.licence_number,
      licence_type: record.model_type,
      licence_holder_name: record.licence_holder_name,
      establishment_id: record.establishment_id,
      establishment_name: record.establishment_name,
      ...getConditions(record, projectConditions),
      deadline: moment(record.deadline).format('YYYY-MM-DD'),
      status: record.deleted ? 'deleted' : 'active'
    };
  };

  const getConditions = (record, projectConditions) => {
    if (['establishment', 'pil'].includes(record.model_type)) {
      return { condition_type: 'custom', condition_content: record.conditions };
    }

    const condition = record.conditions.find(c => c.key === record.condition_key);
    const content = condition.edited || get(projectConditions, condition.path) || '';

    return {
      condition_type: `${condition.type}: ${condition.key}`,
      condition_content: content
    };
  };

  return { query, parse };
};
