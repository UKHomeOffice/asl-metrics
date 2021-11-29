const assert = require('assert');
const { mapKeys, snakeCase, pick } = require('lodash');
const { v4: uuid } = require('uuid');

const db = require('../helpers/db');
const flow = require('../helpers/flow');
const asruUsers = require('../helpers/asru-users');
const generateTask = require('../helpers/generate-task');

const getWorkload = require('../../../lib/routers/asru-workload/get-workload');

const [asruSuper, asruAdmin, inspectorMorse, inspectorGadget, licensing] = asruUsers.map(user =>
  pick(user, 'id', 'firstName', 'lastName', 'asruInspector', 'asruLicensing')
);

describe('ASRU workload stats', () => {

  before(() => {
    this.db = db();

    this.emptyStats = {
      pplApplications: 0,
      pplAmendments: 0,
      pils: 0,
      pels: 0,
      profiles: 0,
      total: 0
    };

    const asruUsersSnakeCase = asruUsers.map(user =>
      mapKeys(user, (value, key) => snakeCase(key))
    );

    return Promise.resolve()
      .then(() => this.db.clean())
      .then(() => this.db.asl('profiles').insert(asruUsersSnakeCase));
  });

  beforeEach(() => {
    return this.db.clean('flow');
  });

  after(() => {
    return this.db.close();
  });

  describe('Open and in progress tasks', () => {
    it('returns zero results if there are no tasks', () => {
      const expected = [];

      return getWorkload({ db: this.db, flow, progress: 'open' })
        .then(results => {
          assert.deepEqual(results, expected);
        });
    });

    it('returns zero results if there are only closed tasks', () => {
      const expected = [];

      return Promise.resolve()
        .then(() => {
          return this.db.flow('cases').insert([
            generateTask('pplApplication', 'resolved')
          ]);
        })
        .then(() => {
          return getWorkload({ db: this.db, flow, progress: 'open' })
            .then(results => {
              assert.deepEqual(results, expected);
            });
        });
    });

    describe('Unassigned tasks', () => {
      it('Can count ppl application tasks', () => {
        const expected = [{
          ...this.emptyStats,
          assignedTo: { id: 'unassigned' },
          pplApplications: 1,
          total: 1
        }];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert(generateTask('pplApplication'));
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });

      it('Can count ppl amendment tasks', () => {
        const expected = [{
          ...this.emptyStats,
          assignedTo: { id: 'unassigned' },
          pplAmendments: 1,
          total: 1
        }];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert(generateTask('pplAmendment'));
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });

      it('Can count pil tasks', () => {
        const expected = [{
          ...this.emptyStats,
          assignedTo: { id: 'unassigned' },
          pils: 2,
          total: 2
        }];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert([
              generateTask('pil'),
              generateTask('trainingPil')
            ]);
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });

      it('Can count pel tasks', () => {
        const expected = [{
          ...this.emptyStats,
          assignedTo: { id: 'unassigned' },
          pels: 3,
          total: 3
        }];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert([
              generateTask('establishment'),
              generateTask('place'),
              generateTask('role')
            ]);
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });

    });

    describe('Assigned tasks', () => {
      it('Can count tasks assigned to inspectors', () => {
        const expected = [
          {
            ...this.emptyStats,
            assignedTo: inspectorMorse,
            pplApplications: 1,
            pels: 1,
            total: 2
          },
          {
            ...this.emptyStats,
            assignedTo: inspectorGadget,
            pplAmendments: 1,
            profiles: 1,
            total: 2
          }
        ];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert([
              generateTask('pplApplication', undefined, inspectorMorse.id),
              generateTask('establishment', undefined, inspectorMorse.id),
              generateTask('profile', undefined, inspectorGadget.id),
              generateTask('pplAmendment', undefined, inspectorGadget.id)
            ]);
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });

      it('Can count tasks assigned to licensing officers', () => {
        const expected = [
          {
            ...this.emptyStats,
            assignedTo: licensing,
            pils: 3,
            total: 3
          }
        ];

        return Promise.resolve()
          .then(() => {
            return this.db.flow('cases').insert([
              generateTask('pil', undefined, licensing.id),
              generateTask('pil', undefined, licensing.id),
              generateTask('pil', undefined, licensing.id)
            ]);
          })
          .then(() => {
            return getWorkload({ db: this.db, flow, progress: 'open' })
              .then(results => {
                assert.deepEqual(results, expected);
              });
          });
      });
    });

    describe('Filtering stats', () => {
      beforeEach(() => {
        return this.db.flow('cases').insert([
          generateTask('pplApplication', 'new'), // not with ASRU
          generateTask('pplAmendment', 'awaiting-endorsement'), // not with ASRU
          generateTask('pplAmendment', 'returned-to-applicant', inspectorMorse.id), // not with ASRU but assigned
          generateTask('pplApplication', 'with-inspectorate'), // with ASRU but unassigned
          generateTask('pplAmendment', 'with-inspectorate', inspectorMorse.id),
          generateTask('establishment', 'referred-to-inspector', inspectorGadget.id),
          generateTask('pil', 'with-licensing', licensing.id),
          generateTask('profile', 'resolved', asruSuper.id), // closed
          generateTask('role', 'discarded-by-asru', asruAdmin.id) // closed
        ]);
      });

      it('can filter the stats to only count tasks with asru', () => {
        const expected = [
          {
            ...this.emptyStats,
            assignedTo: { id: 'unassigned' },
            pplApplications: 1,
            total: 1
          },
          {
            ...this.emptyStats,
            assignedTo: inspectorMorse,
            pplAmendments: 1,
            total: 1
          },
          {
            ...this.emptyStats,
            assignedTo: inspectorGadget,
            pels: 1,
            total: 1
          },
          {
            ...this.emptyStats,
            assignedTo: licensing,
            pils: 1,
            total: 1
          }
        ];

        return getWorkload({ db: this.db, flow, progress: 'open', withAsru: 'yes' })
          .then(results => {
            assert.deepEqual(results, expected);
          });
      });

      it('can filter the stats to only count tasks with establishments', () => {
        const expected = [
          {
            ...this.emptyStats,
            assignedTo: { id: 'unassigned' },
            pplApplications: 1,
            pplAmendments: 1,
            total: 2
          },
          {
            ...this.emptyStats,
            assignedTo: inspectorMorse,
            pplAmendments: 1,
            total: 1
          }
        ];

        return getWorkload({ db: this.db, flow, progress: 'open', withAsru: 'no' })
          .then(results => {
            assert.deepEqual(results, expected);
          });
      });
    });

  });

  describe('Completed tasks', () => {
    beforeEach(() => {
      const resolvedPilId = uuid();
      const rejectedProfileId = uuid();
      const discardedRoleId = uuid();

      return this.db.flow('cases').insert([
        generateTask('pplAmendment', 'returned-to-applicant', inspectorMorse.id), // open
        generateTask('pplApplication', 'with-inspectorate'), // open
        generateTask('pil', 'with-licensing', licensing.id), // open
        generateTask('pil', 'resolved', undefined, resolvedPilId), // closed
        generateTask('profile', 'rejected', undefined, rejectedProfileId), // closed
        generateTask('role', 'discarded-by-asru', undefined, discardedRoleId) // closed
      ])
        .then(() => {
          return this.db.flow('activity_log').insert([
            { case_id: resolvedPilId, changed_by: uuid(), event_name: 'status:endorsed:with-licensing', event: {} },
            { case_id: resolvedPilId, changed_by: inspectorMorse.id, event_name: 'status:with-licensing:resolved', event: {} },

            { case_id: rejectedProfileId, changed_by: uuid(), event_name: 'status:new:with-inspectorate', event: {} },
            { case_id: rejectedProfileId, changed_by: inspectorMorse.id, event_name: 'status:with-inspectorate:rejected', event: {} },

            { case_id: discardedRoleId, changed_by: uuid(), event_name: 'status:new:with-inspectorate', event: {} },
            { case_id: discardedRoleId, changed_by: asruAdmin.id, event_name: 'status:with-inspectorate:discarded-by-asru', event: {} }
          ]);
        });
    });

    it('only counts completed tasks', () => {
      const expected = [
        {
          ...this.emptyStats,
          assignedTo: inspectorMorse,
          pils: 1,
          profiles: 1,
          total: 2
        },
        {
          ...this.emptyStats,
          assignedTo: asruAdmin,
          pels: 1,
          total: 1
        }
      ];

      return getWorkload({ db: this.db, flow, progress: 'closed' })
        .then(results => {
          assert.deepEqual(results, expected);
        });
    });
  });

});
