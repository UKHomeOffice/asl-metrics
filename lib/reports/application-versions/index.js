const { get } = require('lodash');

module.exports = ({ db }) => {

  const query = () => {
    return db.flow('cases')
      .select('*')
      .whereRaw(`cases.data->>'model' = 'project'`)
      .whereRaw(`cases.data->>'action' = 'grant'`)
      .where('cases.status', 'resolved')
      .orderBy('cases.created_at', 'asc');
  };

  const parse = record => {
    const id = get(record, 'data.data.version');
    if (!id) {
      return {
        task: `https://internal.aspel.homeoffice.gov.uk/tasks/${record.id}`,
        status: 'unknown'
      };
    }

    return db.asl('project_versions')
      .select('*')
      .where({ id })
      .first()
      .then(version => {
        if (version && version.status === 'granted') {
          return [];
        }
        return {
          task: `https://internal.aspel.homeoffice.gov.uk/tasks/${record.id}`,
          status: version ? version.status : 'unknown'
        };
      });

  };

  return { query, parse };

};
