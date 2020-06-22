const moment = require('moment-business-time');
const { get } = require('lodash');

module.exports = ({ db, query: params, flow }) => {

  const query = () => {
    return db.flow('cases')
      .leftJoin('activity_log', 'cases.id', 'activity_log.case_id')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.* ORDER BY activity_log.created_at asc) as activity')
      ])
      .whereRaw(`cases.data->>'model' = 'project'`)
      .whereRaw(`cases.data->>'action' = 'grant'`)
      .whereRaw(`cases.data->'modelData'->>'status' = 'inactive'`)
      .where('cases.created_at', '<', moment().subtract(40, 'days').format('YYYY-MM-DD'))
      .where(function () {
        // ignore comment-related activity
        this
          .where('activity_log.event_name', 'like', 'status:%')
          .orWhere('activity_log.event_name', '=', 'update');
      })
      .groupBy('cases.id');
  };

  const parse = record => {

    const getDeadlineState = () => {
      const currentState = record.activity.reduce((state, activity) => {

        // once deadline has passed we don't need to do any more processing
        if (state.hasPassed) {
          return state;
        }

        // check if a deadline has passed since last activity
        if (state.withASRU && state.isCompleteAndCorrect) {
          const deadline = moment(state.submitted).addWorkingTime(state.extended ? 55 : 40, 'days');
          const hasPassed = deadline.isBefore(activity.created_at);
          if (hasPassed) {
            return {
              ...state,
              deadline,
              hasPassed
            };
          }
        }

        // if activity was not a status change then the only thing we're interested in is
        // if it touched the `extended` property
        if (activity.event_name === 'update') {
          return {
            ...state,
            extended: get(activity, 'event.data.extended', false)
          };
        }

        const status = flow[activity.event.status];
        const isSubmission = !state.withASRU && status.withASRU;
        const isClosedOrReturned = !status.open || (state.withASRU && !status.withASRU);

        const meta = get(activity, 'event.data.meta', {});
        const isCompleteAndCorrect = ['authority', 'awerb', 'ready'].every(declaration => {
          return meta[declaration] && meta[declaration].toLowerCase() === 'yes';
        });

        // if it's a submission to the inspector then make note of the date and mark record as with ASRU
        if (isSubmission) {
          return {
            ...state,
            withASRU: true,
            isCompleteAndCorrect,
            submitted: activity.created_at
          };
        }

        // if the record is being returned or closed then flag as not being with ASRU
        if (isClosedOrReturned) {
          return {
            ...state,
            withASRU: false
          };
        }

        return state;
      }, { withASRU: false });

      // if the last activity left the project in an open submitted state then check if the deadline has passed
      if (!currentState.hasPassed && currentState.withASRU && currentState.isCompleteAndCorrect) {
        const deadline = moment(currentState.submitted).addWorkingTime(currentState.extended ? 55 : 40, 'days');
        const hasPassed = deadline.isBefore(moment());
        if (hasPassed) {
          currentState.deadline = deadline;
          currentState.hasPassed = true;
        }
      }

      return currentState;
    };

    const state = getDeadlineState();

    if (state.hasPassed) {
      return db.asl('projects')
        .select(
          'projects.title',
          'establishments.name',
          'profiles.first_name',
          'profiles.last_name'
        )
        .leftJoin('establishments', 'projects.establishment_id', 'establishments.id')
        .leftJoin('profiles', 'projects.licence_holder_id', 'profiles.id')
        .where({ 'projects.id': record.data.id })
        .first()
        .then(project => {
          return {
            title: project.title,
            establishment: project.name,
            licence_holder: `${project.first_name} ${project.last_name}`,
            submitted: moment(state.submitted).toISOString(),
            deadline: state.deadline.toISOString(),
            extended: state.extended ? 'true' : 'false',
            task: record.id
          };
        });
    }
    return Promise.resolve([]);

  };

  return { query, parse };

};
