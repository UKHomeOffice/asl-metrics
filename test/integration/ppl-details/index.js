const assert = require('assert');
const { v4: uuid } = require('uuid');

const db = require('../helpers/db');
const report = require('../../../lib/reports/ppl-details');

const ids = {
  active: uuid(),
  draft: uuid()
};

describe('PPL Details Report', () => {

  before(() => {
    this.db = db();
    return this.db.clean();
  });

  before(() => {
    return Promise.resolve()
      .then(() => this.db.asl('establishments').insert({
        id: 100, name: 'Test Establishment', status: 'active'
      }))
      .then(() => this.db.asl('projects').insert([
        {
          id: ids.active,
          establishment_id: 100,
          title: 'Active Project',
          status: 'active',
          licence_number: 'P1234'
        },
        {
          id: ids.draft,
          establishment_id: 100,
          title: 'Draft Project',
          status: 'inactive'
        }
      ]))
      .then(() => this.db.asl('project_versions').insert([
        {
          project_id: ids.draft,
          data: {
            protocols: [{ severity: 'mild' }]
          },
          status: 'draft',
          created_at: '2020-03-01T12:00:00.000'
        },
        {
          project_id: ids.active,
          data: {
            protocols: [{ severity: 'mild' }, { severity: 'severe' }]
          },
          status: 'granted',
          created_at: '2020-02-01T12:00:00.000'
        },
        {
          project_id: ids.active,
          data: {
            protocols: [{ severity: 'mild' }]
          },
          status: 'granted',
          created_at: '2020-01-01T12:00:00.000'
        }
      ]));
  });

  after(() => {
    return this.db.close();
  });

  it('returns one row per granted project', () => {
    const { query, parse } = report({ db: this.db });
    return query()
      .then(result => result.map(parse))
      .then(result => Promise.all(result))
      .then(result => {
        assert.equal(result.length, 1);
        assert.equal(result[0].licence_number, 'P1234');
      });
  });

  it('returns protocol counts and severities based on most recent version', () => {
    const { query, parse } = report({ db: this.db });
    return query()
      .then(result => result.map(parse))
      .then(result => Promise.all(result))
      .then(result => {
        assert.equal(result[0].protocol_count, '2');
        assert.equal(result[0].highest_severity, 'severe');
      });
  });

});
