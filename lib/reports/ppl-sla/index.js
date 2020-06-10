const moment = require('moment-business-time');
const { get } = require('lodash');

module.exports = ({ db, query: params, flow }) => {
  const query = () => {
    return db.flow('cases')
      .leftJoin('activity_log','cases.id','activity_log.case_id')
      .select([
        'cases.*',
        db.flow.raw('JSON_AGG(activity_log.*) as activity')
      ])
      .whereRaw(`data->>'model' = 'project'`)
      .whereRaw(`data->>'action' = 'grant'`)
      .whereRaw(`data->'modelData'->>'status' = 'inactive'`)
      .where('cases.created_at', '<', moment().subtract(40, 'days').format('YYYY-MM-DD'))
      .groupBy('cases.id');
  };

  const parse = () => record => {

    const getDeadlineState = () => {
      const currentState = record.activity.reduce((state, activity) => {
        const status = flow[activity.event.status];
        state.extended = state.extended || get(activity, 'event.data.extended', false);
        const isSubmission = !state.withASRU && status.withASRU;
        const isClosedOrReturned = state.withASRU && !status.withASRU;

        const meta = get(activity, 'event.data.meta', {});

        const isCompleteAndCorrect = ['authority', 'awerb', 'ready'].every(declaration => {
          return meta[declaration] && meta[declaration].toLowerCase() === 'yes';
        });

        // if it's a submission to the inspector then make note of the date and mark record as with ASRU
        if (isSubmission && isCompleteAndCorrect) {
          return {
            ...state,
            withASRU: true,
            submitted: activity.created_at
          };
        }
        // if the record is being returned or closed then check if a deadline has passed
        if (isClosedOrReturned) {
          const deadline = moment(state.submitted).addWorkingTime(state.extended ? 55 : 40, 'days');
          const hasPassed = deadline.isBefore(activity.created_at);
          return {
            ...state,
            withASRU: false,
            deadline: hasPassed ? deadline : state.deadline,
            hasPassed: hasPassed || state.hasPassed
          };
        }
        return state;
      }, { withASRU: false, submitted: record.created_at });

      // if the last activity left the project in an open submitted state then check if the deadline has passed
      if (currentState.withASRU) {
        const deadline = moment(currentState.submitted).addWorkingTime(currentState.extended ? 55 : 40, 'days');
        const hasPassed = deadline.isBefore(moment());
        currentState.deadline = hasPassed ? deadline : currentState.deadline;
        currentState.hasPassed = hasPassed || currentState.hasPassed;
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
            submitted: state.submitted,
            deadline: state.deadline,
            extended: state.extended ? 'true' : 'false',
            task: record.id
          };
        });
    }
    return [];

  };

  return { query, parse };

}