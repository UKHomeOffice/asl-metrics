const moment = require('moment-business-time');
const { bankHolidays } = require('@asl/constants');
const { get } = require('lodash');
const projectApplicationsQuery = require('./project-applications-query');

// configure bank holidays
moment.updateLocale('en', { holidays: bankHolidays });

module.exports = ({ db, query: params, flow }) => {

  const since = (params && params.since) ? moment(params.since, 'YYYY-MM-DD') : null;

  const parse = task => {

    const getDeadlineState = () => {
      const currentState = task.activity.reduce((state, activity) => {
        const deadlinePassedReason = get(activity, 'event.data.meta.deadline-passed-reason');

        if (deadlinePassedReason) {
          state.reason = {
            comment: deadlinePassedReason,
            updatedAt: activity.updated_at,
            actionedBy: get(activity, 'event.meta.user.profile')
          };
        }

        const deadline = get(activity, 'event.data.deadline');

        if (deadline && deadline.exemption) {
          if (state.exemption.isExempt !== deadline.exemption.isExempt) {
            state.exemption.isExempt = deadline.exemption.isExempt;
            state.exemption.reasons.push({
              comment: deadline.exemption.reason,
              updatedAt: activity.updated_at,
              actionedBy: get(activity, 'event.meta.user.profile')
            });
          }
        }

        // once deadline has passed we don't need to do any more processing
        if (state.hasPassed) {
          return state;
        }

        // check if a deadline has passed since last activity
        if (state.withASRU && state.isCompleteAndCorrect) {
          const deadline = moment(state.submitted).addWorkingTime(state.extended ? 55 : 40, 'days');
          const hasPassed = deadline.isBefore(activity.created_at, 'day');
          if (hasPassed) {
            return {
              ...state,
              deadline,
              hasPassed
            };
          }
        }

        // if activity was not a status change then the only thing we're interested in is if it was a deadline extension
        if (activity.event_name === 'update') {
          return {
            ...state,
            extended: get(activity, 'event.data.deadline.isExtended') || get(activity, 'event.data.extended', false)
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
      }, { withASRU: false, exemption: { isExempt: false, reasons: [] } });

      // if the last activity left the project in an open submitted state then check if the deadline has passed
      if (!currentState.hasPassed && currentState.withASRU && currentState.isCompleteAndCorrect) {
        const deadline = moment(currentState.submitted).addWorkingTime(currentState.extended ? 55 : 40, 'days');
        const hasPassed = deadline.isBefore(moment(), 'day');
        if (hasPassed) {
          currentState.deadline = deadline;
          currentState.hasPassed = true;
        }
      }

      return currentState;
    };

    const state = getDeadlineState();

    const isSinceCutoff = deadline => {
      if (!since) {
        return true;
      }
      return moment(deadline).isAfter(since);
    };

    if (state.hasPassed && isSinceCutoff(state.deadline)) {
      return db.asl('projects')
        .select('projects.id', 'projects.title', 'projects.establishment_id')
        .where({ 'projects.id': task.data.id })
        .first()
        .then(project => {
          return {
            id: task.id,
            projectId: project.id,
            projectTitle: project.title,
            establishmentId: project.establishment_id,
            submitted: moment(state.submitted).toISOString(),
            deadline: state.deadline.format('YYYY-MM-DD'),
            extended: state.extended ? 'true' : 'false',
            deadlineObj: task.data.deadline,
            daysOverdue: moment().diff(state.deadline, 'days'),
            reason: state.reason,
            exemption: state.exemption,
            isExempt: state.exemption.isExempt
          };
        });
    }
    return Promise.resolve([]);

  };

  return {
    query: () => projectApplicationsQuery(db),
    parse
  };
};
