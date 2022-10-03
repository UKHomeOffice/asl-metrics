const Knex = require('knex');
const { v4: uuid } = require('uuid');
const settings = require('../../config');

const randomDate = () => {
  const start = new Date('2022-01-01');
  const end = new Date('2023-12-31');
  const random = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return `${random.getFullYear()}-${random.getMonth() + 1}-${random.getDate()}`;
};

const defaultProps = () => {
  return {
    id: uuid(),
    deadline: randomDate(),
    status: 'active'
  };
};

const generateReminders = () => {
  const aslDb = Knex({ client: 'pg', connection: settings.asldb });

  const establishmentsQuery = aslDb
    .select('*')
    .from('establishments')
    .where('status', 'active')
    .whereNotNull('conditions')
    .where('conditions', '<>', '');

  const pilsQuery = aslDb
    .select('*')
    .from('pils')
    .where('status', 'active')
    .whereNotNull('conditions')
    .where('conditions', '<>', '');

  const versionsQuery = aslDb
    .select('project_versions.*')
    .select('projects.establishment_id')
    .from('project_versions')
    .leftJoin('projects', 'project_versions.project_id', 'projects.id')
    .where('project_versions.status', 'granted')
    .whereRaw(`jsonb_array_length(project_versions.data->'conditions') > 0`);

  return Promise.all([establishmentsQuery, pilsQuery, versionsQuery])
    .then(([establishments, pils, versions]) => {
      const reminders = [];

      establishments.map(e => {
        reminders.push({
          ...defaultProps(),
          establishment_id: e.id,
          model_type: 'establishment'
        });
      });

      pils.map(pil => {
        reminders.push({
          ...defaultProps(),
          establishment_id: pil.establishment_id,
          model_type: 'pil',
          model_id: pil.id
        });
      });

      versions.map(version => {
        version.data.conditions.map(condition => {
          reminders.push({
            ...defaultProps(),
            establishment_id: version.establishment_id,
            model_type: 'project',
            model_id: version.project_id,
            condition_key: condition.key
          });
        });
      });

      return aslDb('reminders').insert(reminders);
    });
};

module.exports = generateReminders;
