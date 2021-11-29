const { get } = require('lodash');

module.exports = ({ db, query: params }) => {

  const query = () => {
    const q = db.flow('cases')
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.event_name) as activity')
      ])
      .where({ status: 'resolved' })
      .whereRaw(`(data->>'establishmentId' != '1502162' or data->>'establishmentId' is null)`)
      .where('cases.updated_at', '>', params.start || '2019-07-01')
      .where('cases.updated_at', '<', `${params.end}T23:59:59.999Z` || (new Date()).toISOString())
      .groupBy('cases.id');

    if (params.establishment) {
      q.whereRaw(`data->>'establishmentId' = ?`, [params.establishment]);
    }

    if (params.initiatedBy === 'asru') {
      q.whereRaw(`data->>'initiatedByAsru' = 'true'`);
    } else if (params.initiatedBy === 'external') {
      q.whereRaw(`(data->>'initiatedByAsru' = 'false' OR data->>'initiatedByAsru' IS NULL)`);
    }
    return q;
  };

  const parse = record => {
    const model = record.data.model;
    const schemaVersion = get(record, 'data.modelData.schemaVersion', 0);
    let action = record.data.action;

    if (['pil', 'trainingPil', 'project', 'establishment'].includes(model) && action === 'grant') {
      const isAmendment = get(record, 'data.modelData.status') === 'active';
      action = isAmendment ? 'amendment' : 'application';
    }

    if (model === 'project' && action === 'update') {
      const existingLicenceHolderId = get(record, 'data.modelData.licenceHolderId');
      const newLicenceHolderId = get(record, 'data.data.licenceHolderId');

      if (newLicenceHolderId && newLicenceHolderId !== existingLicenceHolderId) {
        action = 'change-licence-holder';
      } else {
        action = 'amendment';
      }
    }

    const iterations = record.activity.filter(e => e && e.match(/^status:(.)*:returned-to-applicant$/)).length + 1;
    const updatedAt = record.updated_at;
    const createdAt = record.created_at;
    const establishmentId = get(record, 'data.establishmentId');

    return {
      model,
      action,
      status: record.status,
      schemaVersion,
      iterations,
      createdAt,
      updatedAt,
      establishmentId
    };
  };

  return { query, parse };

};
