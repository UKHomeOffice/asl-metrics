const assert = require('assert');
const { v4: uuid } = require('uuid');
const { flatten } = require('lodash');

const db = require('../helpers/db');
const flow = require('../helpers/flow');
const report = require('../../../lib/reports/ppl-applications');

const ids = {
  task: uuid(),
  issueDateTask: uuid(),
  active: uuid(),
  issueDate: uuid()
};

describe('PPL Applications Report', () => {

  before(() => {
    this.db = db();
    return this.db.clean();
  });

  before(() => {
    return Promise.resolve()
      .then(() => this.db.flow('cases').insert([
        {
          id: ids.task,
          status: 'resolved',
          data: {
            model: 'project',
            action: 'grant',
            id: ids.active,
            modelData: {
              status: 'inactive'
            }
          },
          created_at: '2020-01-11T12:00:00.000'
        },
        {
          id: ids.issueDateTask,
          status: 'resolved',
          data: {
            model: 'project',
            action: 'grant',
            id: ids.issueDate,
            modelData: {
              status: 'inactive'
            }
          },
          created_at: '2020-01-12T12:00:00.000'
        }
      ]))
      .then(() => this.db.flow('activity_log').insert([
        {
          case_id: ids.issueDateTask,
          event_name: 'status:new:awaiting-endorsement',
          event: {},
          created_at: '2020-01-12T12:00:00.000'
        },
        {
          case_id: ids.task,
          event_name: 'status:new:awaiting-endorsement',
          event: {},
          created_at: '2020-01-11T12:00:00.000'
        },
        {
          case_id: ids.task,
          event_name: 'status:awaiting-endorsement:with-inspectorate',
          event: {},
          created_at: '2020-01-16T12:00:00.000'
        },
        {
          case_id: ids.task,
          event_name: 'status:with-inspectorate:inspector-recommended',
          event: {},
          created_at: '2020-01-21T12:00:00.000'
        },
        {
          case_id: ids.task,
          event_name: 'status:inspector-recommended:resolved',
          event: {},
          created_at: '2020-01-26T12:00:00.000'
        }
      ]))
      .then(() => this.db.asl('establishments').insert({
        id: 100, name: 'Test Establishment', status: 'active'
      }))
      .then(() => this.db.asl('projects').insert([
        {
          id: ids.active,
          establishment_id: 100,
          title: 'Active Project',
          status: 'active',
          licence_number: 'P1234',
          issue_date: '2020-01-26T12:00:00.000',
          created_at: '2020-01-01T12:00:00.000'
        },
        {
          id: ids.issueDate,
          establishment_id: 100,
          title: 'Changed issue date',
          status: 'active',
          licence_number: 'P1111',
          issue_date: '2018-01-01T12:00:00.000',
          created_at: '2020-01-01T12:00:00.000'
        }
      ]))
      .then(() => this.db.asl('project_versions').insert([
        {
          project_id: ids.active,
          data: {
            protocols: [{ severity: 'mild' }, { severity: 'severe' }]
          },
          status: 'granted',
          created_at: '2020-02-01T12:00:00.000'
        }
      ]));
  });

  after(() => {
    return this.db.close();
  });

  it('returns one row per complete project application', () => {
    const { query, parse } = report({ db: this.db, flow });
    return query()
      .then(result => result.map(parse))
      .then(result => Promise.all(result))
      .then(result => flatten(result))
      .then(result => {
        assert.equal(result.length, 1);
      });
  });

  it('calculates timing of phases of application', () => {
    const { query, parse } = report({ db: this.db, flow });
    return query()
      .then(result => result.map(parse))
      .then(result => Promise.all(result))
      .then(result => flatten(result))
      .then(result => {
        assert.equal(result[0].totalTime, 25);
        assert.equal(result[0].timeDraftingPreSubmission, 10);
        assert.equal(result[0].timeWithEstablishment, 15);
        assert.equal(result[0].timeWithInspector, 5);
        assert.equal(result[0].timeWithLicensing, 5);
        assert.equal(result[0].timeWithASRU, 10);
        assert.equal(result[0].timeWithASRUPercentage, '40%');
      });
  });

  it('ignores projects with issue dates pre-aspel', () => {
    const { query, parse } = report({ db: this.db, flow });
    return query()
      .then(result => result.map(parse))
      .then(result => Promise.all(result))
      .then(result => flatten(result))
      .then(result => {
        assert.ok(result.every(row => row.title !== 'Changed issue date'));
      });
  });

});
