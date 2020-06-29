const { get } = require('lodash');

module.exports = ({ db, query: params, flow }) => {

  const query = () => {
    return db.flow('cases')
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.event_name) as activity')
      ])
      .where({ status: 'resolved' })
      .whereRaw(`data->>'establishmentId' != '1502162'`)
      .where('cases.updated_at', '>', params.since || '2019-07-01')
      .groupBy('cases.id');
  };

  const parse = record => {
    const model = record.data.model;
    const schemaVersion = get(record, 'data.modelData.schemaVersion', 0);
    let action = record.data.action;

    if (['pil', 'project'].includes(model) && action === 'grant') {
      const isAmendment = get(record, 'data.modelData.status') === 'active';
      action = isAmendment ? 'amendment' : 'application';
    }

    const iterations = record.activity.filter(e => e.match(/^status:[.]*:resubmitted/)).length + 1;
    const updatedAt = record.updated_at;

    return { model, action, schemaVersion, iterations, updatedAt };
  };

  return { query, parse };

};
