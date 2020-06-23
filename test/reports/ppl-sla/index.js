const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');
const uuid = require('uuid').v4;

const report = require('../../../lib/reports/ppl-sla');
const flow = require('./data/flow');

describe('PPL SLA report', () => {

  beforeEach(() => {
    // pretend it's midday on March 25th
    this.clock = sinon.useFakeTimers(moment('2020-03-25T12:00:00.000Z').valueOf());

    this.db = () => {
      return {
        asl: sinon.stub().returns({
          select: sinon.stub().returnsThis(),
          leftJoin: sinon.stub().returnsThis(),
          where: sinon.stub().returnsThis(),
          first: sinon.stub().resolves({
            title: 'Test project title'
          })
        })
      };
    };
  });

  afterEach(() => {
    this.clock.restore();
  });

  describe('parse', () => {

    it('flags as having passed if application is not touched for more than 40 days', () => {
      const input = {
        activity: require('./data/untouched-after-submission'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.equal(result.deadline, '2020-03-19T10:44:37.173Z');
        });
    });

    it('does not flag as having passed if application has had deadline extended', () => {
      const input = {
        activity: require('./data/deadline-extended-last-activity'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

    it('does not flag as having passed if application is processed within the deadline', () => {
      const input = {
        activity: require('./data/resolved-within-deadline'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

    it('ignores submissions which are not complete and correct', () => {
      const input = {
        activity: require('./data/not-complete-and-correct'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

    it('flags submissions which are complete and correct and wait more than 40 working days', () => {
      const input = {
        activity: require('./data/complete-and-correct'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.equal(result.submitted, '2020-01-23T10:44:37.173Z');
          assert.equal(result.deadline, '2020-03-19T10:44:37.173Z');
        });
    });

    it('uses submission date of first submission that passed a deadline if submitted multiple times', () => {
      const input = {
        activity: require('./data/multiple-submissions'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.equal(result.submitted, '2020-01-23T10:44:37.173Z');
          assert.equal(result.deadline, '2020-03-19T10:44:37.173Z');
        });
    });

    it('does not flag as having passed if deadline was extended before it passed', () => {
      const input = {
        activity: require('./data/deadline-extended-before-expiry'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

    it('flags as having passed if deadline was extended after it passed', () => {
      const input = {
        activity: require('./data/deadline-extended-after-expiry'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.equal(result.deadline, '2020-03-19T10:44:37.173Z');
          // shows false because the deadline had not been extended at the point of expiry
          assert.equal(result.extended, 'false');
        });
    });

    it('should not flag if resolved on the same day as the deadline, but at a later time', () => {
      const input = {
        activity: require('./data/passed-same-day'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

    it('should not flag if open, but deadline expired earlier on the same day', () => {
      const input = {
        activity: require('./data/unresolved-same-day'),
        data: {
          id: uuid()
        }
      };
      return report({ flow: flow(), db: this.db() }).parse(input)
        .then(result => {
          assert.deepEqual(result, []);
        });
    });

  });

});
