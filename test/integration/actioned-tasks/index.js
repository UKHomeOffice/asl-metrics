const assert = require('assert');
const db = require('../helpers/db');
const flow = require('../helpers/flow');
const generateTask = require('../../helpers/generate-task');
const getStats = require('../../../lib/routers/actioned-tasks/get-stats');

const defaultStats = {
  submitted: 0,
  returned: 0,
  approved: 0,
  rejected: 0,
  outstanding: 0,
  submitToActionDays: '-',
  assignToActionDays: '-'
};

const emptyResults = {
  pplApplication: { ...defaultStats },
  pplAmendment: { ...defaultStats },
  ra: { ...defaultStats },
  pel: { ...defaultStats },
  pilApplication: { ...defaultStats },
  pilAmendment: { ...defaultStats },
  pilRevocation: { ...defaultStats },
  trainingPil: { ...defaultStats }
};

describe('Actioned tasks stats', () => {
  before(() => {
    this.db = db();

    return Promise.resolve()
      .then(() => this.db.clean());
  });

  beforeEach(() => {
    return this.db.clean('flow');
  });

  after(() => {
    return this.db.close();
  });

  it('returns empty results if there are no tasks found', () => {
    return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
      .then(results => {
        assert.deepEqual(results, emptyResults);
      });
  });

  it('returns empty results if there are no tasks actioned in the report period', () => {
    return Promise.resolve()
      .then(() => {
        const pplApplication = generateTask({ createdAt: '2021-11-01' });
        pplApplication.history('with-inspectorate', 0);
        pplApplication.history('resolved', 1);

        const pplAmendment = generateTask({ createdAt: '2022-01-01', type: 'amendment' });
        pplAmendment.history('with-inspectorate', 0);
        pplAmendment.history('resolved', 1);

        return this.db.insertTasks([pplApplication, pplAmendment]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            assert.deepEqual(results, emptyResults);
          });
      });
  });

  it('returns correct stats for ppl applications', () => {
    return Promise.resolve()
      .then(() => {
        const submittedReturned = generateTask({ createdAt: '2021-12-01' });
        submittedReturned.history('with-inspectorate', 0);
        submittedReturned.history('returned-to-applicant', 2);

        const submittedResolved = generateTask({ createdAt: '2021-12-01' });
        submittedResolved.history('with-inspectorate', 0);
        submittedResolved.history('resolved', 2);

        const submittedBeforeResolvedDuringPeriod = generateTask({ createdAt: '2021-11-30' });
        submittedBeforeResolvedDuringPeriod.history('with-inspectorate', 0);
        submittedBeforeResolvedDuringPeriod.history('resolved', 2);

        return this.db.insertTasks([submittedReturned, submittedResolved, submittedBeforeResolvedDuringPeriod]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pplApplication: {
                submitted: 2,
                returned: 1,
                approved: 2,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 2,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('returns correct stats for retrospective assessments', () => {
    return Promise.resolve()
      .then(() => {
        const submittedResolved = generateTask({ createdAt: '2021-12-01', action: 'grant-ra' });
        submittedResolved.history('with-inspectorate', 0);
        submittedResolved.history('resolved', 2);

        return this.db.insertTasks([submittedResolved]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              ra: {
                submitted: 1,
                returned: 0,
                approved: 1,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 2,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('can count tasks that were returned multiple times', () => {
    return Promise.resolve()
      .then(() => {
        const returnedTwice = generateTask({ createdAt: '2021-12-01', type: 'amendment' });
        returnedTwice.history('with-inspectorate', 0);
        returnedTwice.history('returned-to-applicant', 2); // inside report period, counted
        returnedTwice.history('with-inspectorate', 0, true);
        returnedTwice.history('returned-to-applicant', 2); // inside report period, counted
        returnedTwice.history('with-inspectorate', 0, true);
        returnedTwice.history('resolved', 1);

        const returnedBeforePeriod = generateTask({ createdAt: '2021-11-20', type: 'amendment' });
        returnedBeforePeriod.history('with-inspectorate', 0);
        returnedBeforePeriod.history('returned-to-applicant', 2); // outside report period, not counted
        returnedBeforePeriod.history('with-inspectorate', 0, true);
        returnedBeforePeriod.history('resolved', 10);

        return this.db.insertTasks([returnedTwice, returnedBeforePeriod]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pplAmendment: {
                submitted: 1,
                returned: 2,
                approved: 2,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 7,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('does not count returns by the establishment admin', () => {
    return Promise.resolve()
      .then(() => {
        const returnedByAdmin = generateTask({ createdAt: '2021-12-01' });
        returnedByAdmin.history('awaiting-endorsement', 0);
        returnedByAdmin.history('returned-to-applicant', 2); // should be ignored

        return this.db.insertTasks([returnedByAdmin]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pplAmendment: {
                submitted: 0,
                returned: 0,
                approved: 0,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: '-',
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('can count average time from assignment to resolution', () => {
    return Promise.resolve()
      .then(() => {
        const assignedToInspector = generateTask({ model: 'establishment', createdAt: '2021-12-01', type: 'amendment' });
        assignedToInspector.history('with-inspectorate', 0);
        assignedToInspector.history('assign', 2);
        assignedToInspector.history('resolved', 2);

        return this.db.insertTasks([assignedToInspector]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pel: {
                submitted: 1,
                returned: 0,
                approved: 1,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 4,
                assignToActionDays: 2
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('can count application rejections', () => {
    return Promise.resolve()
      .then(() => {
        const submittedRejected = generateTask({ model: 'pil', createdAt: '2021-12-01' });
        submittedRejected.history('with-inspectorate', 0);
        submittedRejected.history('rejected', 2);

        return this.db.insertTasks([submittedRejected]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pilApplication: {
                submitted: 1,
                returned: 0,
                approved: 0,
                rejected: 1,
                outstanding: 0,
                submitToActionDays: 2,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('returns correct stats for PIL revocations', () => {
    return Promise.resolve()
      .then(() => {
        const submittedResolved = generateTask({ model: 'pil', createdAt: '2021-12-01', action: 'revoke' });
        submittedResolved.history('with-inspectorate', 0);
        submittedResolved.history('resolved', 2);

        return this.db.insertTasks([submittedResolved]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pilRevocation: {
                submitted: 1,
                returned: 0,
                approved: 1,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 2,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('returns correct stats for training Pils', () => {
    return Promise.resolve()
      .then(() => {
        const submittedResolved = generateTask({ model: 'trainingPil', createdAt: '2021-12-01' });
        submittedResolved.history('with-inspectorate', 0);
        submittedResolved.history('resolved', 2);

        return this.db.insertTasks([submittedResolved]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              trainingPil: {
                submitted: 1,
                returned: 0,
                approved: 1,
                rejected: 0,
                outstanding: 0,
                submitToActionDays: 2,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

  it('can count tasks that are outstanding at the end of the report period', () => {
    return Promise.resolve()
      .then(() => {
        const submittedBeforeResolvedBefore = generateTask({ createdAt: '2021-11-01' }); // not outstanding
        submittedBeforeResolvedBefore.history('with-inspectorate', 0);
        submittedBeforeResolvedBefore.history('resolved', 2);

        const submittedBeforeResolvedDuring = generateTask({ createdAt: '2021-11-30' }); // not outstanding
        submittedBeforeResolvedDuring.history('with-inspectorate', 0);
        submittedBeforeResolvedDuring.history('resolved', 5);

        const submittedBeforeResolvedAfter = generateTask({ createdAt: '2021-11-30' }); // outstanding
        submittedBeforeResolvedAfter.history('with-inspectorate', 0);
        submittedBeforeResolvedAfter.history('resolved', 40);

        const submittedDuringResolvedAfter = generateTask({ createdAt: '2021-12-01' }); // outstanding
        submittedDuringResolvedAfter.history('with-inspectorate', 0);
        submittedDuringResolvedAfter.history('resolved', 40);

        const submittedDuringStillOpen = generateTask({ createdAt: '2021-12-01' }); // outstanding
        submittedDuringStillOpen.history('with-inspectorate', 0);

        const submittedAfterStillOpen = generateTask({ createdAt: '2022-01-01' }); // not outstanding
        submittedAfterStillOpen.history('with-inspectorate', 0);

        return this.db.insertTasks([
          submittedBeforeResolvedBefore,
          submittedBeforeResolvedDuring,
          submittedBeforeResolvedAfter,
          submittedDuringResolvedAfter,
          submittedDuringStillOpen,
          submittedAfterStillOpen
        ]);
      })
      .then(() => {
        return getStats({ db: this.db, flow, start: '2021-12-01', end: '2021-12-31' })
          .then(results => {
            const expected = {
              ...emptyResults,
              pplApplication: {
                submitted: 2,
                returned: 0,
                approved: 1,
                rejected: 0,
                outstanding: 3,
                submitToActionDays: 5,
                assignToActionDays: '-'
              }
            };

            assert.deepEqual(results, expected);
          });
      });
  });

});
