const assert = require('assert');

const report = require('../../../lib/reports/tasks');

describe('PPL SLA report', () => {

  describe('parse', () => {

    it('correctly sets iteration count on tasks', () => {
      const input = {
        // log data from a real task, in no particular order
        activity: [
          'update',
          'update',
          'status:inspector-recommended:resolved',
          'create',
          'status:resubmitted:with-inspectorate',
          'status:with-inspectorate:inspector-recommended',
          'update',
          'update',
          'status:returned-to-applicant:resubmitted',
          'update',
          'status:new:awaiting-endorsement',
          'update',
          'status:awaiting-endorsement:endorsed',
          'update',
          'update',
          'status:endorsed:with-inspectorate',
          'update',
          'status:with-inspectorate:returned-to-applicant',
          'update',
          'update'
        ],
        data: {
          model: 'project',
          action: 'grant'
        },
        updated_at: '2019-09-01T12:00:00.000Z'
      };
      return Promise.resolve()
        .then(() => {
          return report({}).parse(input);
        })
        .then(result => {
          assert.equal(result.iterations, 2);
        });
    });

    it('returns a camelCased `updatedAt` field', () => {
      const input = {
        activity: [],
        data: {
          model: 'project',
          action: 'grant'
        },
        updated_at: '2019-09-01T12:00:00.000Z'
      };
      return Promise.resolve()
        .then(() => {
          return report({}).parse(input);
        })
        .then(result => {
          assert.equal(result.updatedAt, '2019-09-01T12:00:00.000Z');
        });
    });

    it('returns an action of "amendment" on project grant tasks if modelData has status of active', () => {
      const input = {
        activity: [],
        data: {
          model: 'project',
          action: 'grant',
          modelData: {
            status: 'active'
          }
        },
        updated_at: '2019-09-01T12:00:00.000Z'
      };
      return Promise.resolve()
        .then(() => {
          return report({}).parse(input);
        })
        .then(result => {
          assert.equal(result.action, 'amendment');
        });
    });

    it('returns an action of "amendment" on project grant tasks if modelData has status of inactive', () => {
      const input = {
        activity: [],
        data: {
          model: 'project',
          action: 'grant',
          modelData: {
            status: 'inactive'
          }
        },
        updated_at: '2019-09-01T12:00:00.000Z'
      };
      return Promise.resolve()
        .then(() => {
          return report({}).parse(input);
        })
        .then(result => {
          assert.equal(result.action, 'application');
        });
    });

  });

});
