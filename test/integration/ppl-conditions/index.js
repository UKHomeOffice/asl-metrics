require('@babel/register')({
  ignore: [
    function (filepath) {
      return filepath.match(/\/node_modules\//) && !filepath.match(/\/node_modules\/@(asl|ukhomeoffice)/);
    }
  ]
});

const assert = require('assert');
const {v4: uuid} = require('uuid');

const dbProvider = require('../helpers/db');
const report = require('../../../lib/reports/ppl-conditions');

function insertTestEstablishment(aslDb) {
  return aslDb('establishments')
    .insert({
      id: 100,
      name: 'Test Establishment',
      status: 'active'
    });
}

const projectDefaults = {
  title: 'Test project',
  licence_number: 'PL-123456',
  status: 'active',
  issue_date: '2024-10-01T12:00:00.000',
  establishment_id: 100,
  schema_version: 1
};

const expectedProjectColumns = {
  establishment: 'Test Establishment',
  title: 'Test project',
  licence_number: 'PL-123456',
  status: 'active',
  schema_version: 1,
  issue_date: '2024-10-01'
};

async function insertProject(
  aslDb,
  {
    conditions = undefined,
    protocols = undefined,
    projectOverrides = {},
    projectVersionOverrides = {}
  }
) {
  const project = {
    ...projectDefaults,
    id: uuid(undefined, undefined, undefined),
    ...projectOverrides
  };

  const projectVersion = {
    id: uuid(undefined, undefined, undefined),
    project_id: project.id,
    status: 'granted',
    created_at: '2024-10-01T12:00:00.000',
    ...projectVersionOverrides,
    data: {
      conditions,
      protocols
    }
  };

  await aslDb('projects').insert(project);
  await aslDb('project_versions').insert(projectVersion);

  return {project, projectVersion};
}

async function runReport(db) {
  const { query, parse } = report({ db });
  const dbResult = await query();
  return Promise.all(dbResult.flatMap(parse));
}

function protocolWithConditions(title, conditions) {
  return {
    id: uuid(undefined, undefined, undefined),
    title,
    conditions
  };
}

describe('PPL Conditions Report', () => {
  let db;

  before(async () => {
    db = dbProvider();
    await db.clean();
    await insertTestEstablishment(db.asl);
  });

  after(async () => {
    await db.close();
  });

  afterEach(async () => {
    await db.asl.raw('TRUNCATE TABLE projects CASCADE');
  });

  it('Should output an empty row for projects without conditions', async () => {
    await insertProject(db.asl, {});
    const result = await runReport(db);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      ...expectedProjectColumns,
      level: '',
      protocol_name: '',
      type: '',
      condition: 'none',
      requires_editing: '',
      edited: '',
      content: ''
    });
  });

  it('Should output auto-added conditions', async () => {
    await insertProject(
      db.asl,
      {
        conditions: [
          {key: 'nmbas', path: 'nmbas.versions.0', type: 'condition', autoAdded: true}
        ]}
    );
    const result = await runReport(db);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      ...expectedProjectColumns,
      level: 'project',
      protocol_name: '',
      type: 'condition',
      condition: 'Neuromuscular blocking agents (NMBAs)',
      requires_editing: 'false',
      edited: '',
      content: 'All work under authority of this licence involving the use of neuromuscular blocking agents must be carried out in accordance with the Home Office guidelines.'
    });
  });

  it('Should output inspector-added conditions', async () => {
    await insertProject(
      db.asl,
      {
        conditions: [
          {
            key: 'batch-testing',
            type: 'condition',
            title: 'Batch testing',
            checked: true,
            content: 'For all batch quality control testing using live animals, ...',
            inspectorAdded: true
          }
        ]}
    );
    const result = await runReport(db);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      ...expectedProjectColumns,
      level: 'project',
      protocol_name: '',
      type: 'condition',
      condition: 'Batch testing',
      requires_editing: 'false',
      edited: '',
      content: 'For all batch quality control testing using live animals, ...'
    });
  });

  it('Should output custom conditions', async () => {
    await insertProject(
      db.asl,
      {
        conditions: [
          {
            key: 'f22b91ce-4cd5-4eb3-9ffe-7ed9241be4f0',
            type: 'condition',
            custom: true,
            content: 'Custom condition 1'
          }
        ]}
    );
    const result = await runReport(db);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      ...expectedProjectColumns,
      level: 'project',
      protocol_name: '',
      type: 'condition',
      condition: 'CUSTOM',
      requires_editing: 'false',
      edited: '',
      content: 'Custom condition 1'
    });
  });

  it('Should output retrospective assessment', async () => {
    await insertProject(
      db.asl,
      {
        conditions: [
          {
            key: 'retrospective-assessment',
            type: 'condition',
            title: 'Retrospective assessment required',
            checked: true,
            content: 'Should be ignored',
            inspectorAdded: true
          }
        ]}
    );
    const result = await runReport(db);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      ...expectedProjectColumns,
      level: 'project',
      protocol_name: '',
      type: 'condition',
      condition: 'Retrospective assessment',
      requires_editing: 'false',
      edited: '',
      content: 'The Secretary of State has determined that a retrospective assessment of this licence is required, and should be submitted within 6 months of the licence\'s revocation date.'
    });
  });

  it('Should merge protocol conditions as extra rows', async () => {
    await insertProject(
      db.asl,
      {
        conditions: [
          {
            key: 'batch-testing',
            type: 'condition',
            title: 'Batch testing',
            checked: true,
            content: 'For all batch quality control testing using live animals, ...',
            inspectorAdded: true
          }
        ],
        protocols: [
          protocolWithConditions(
            'Protocol 1',
            [
              {
                key: 'reuse',
                path: 'reuse.versions.1',
                type: 'authorisation',
                edited: 'Edited content',
                autoAdded: true
              }
            ]
          ),
          protocolWithConditions('Protocol 2', [{key: 'd94d1c46-f487-473a-866b-020f951fcb89', type: 'condition', custom: true, content: 'Custom condition protocol 2'}])
        ]
      }
    );

    const result = await runReport(db);

    assert.equal(result.length, 3);
    assert.deepEqual(
      result.find(c => c.condition === 'Batch testing'),
      {
        ...expectedProjectColumns,
        level: 'project',
        protocol_name: '',
        type: 'condition',
        condition: 'Batch testing',
        requires_editing: 'false',
        edited: '',
        content: 'For all batch quality control testing using live animals, ...'
      }
    );

    assert.deepEqual(
      result.find(c => c.condition === 'Re-use'),
      {
        ...expectedProjectColumns,
        level: 'protocol',
        protocol_name: 'Protocol 1',
        type: 'authorisation',
        condition: 'Re-use',
        requires_editing: 'false',
        edited: 'Edited content',
        content: '<<<INSERT animal type(s) HERE>>> that have been kept alive and maintained under the supervision of a veterinary surgeon or other suitably qualified person at <<<INSERT place HERE>>> may be re-used in this protocol, provided that all criteria in section 14 of the Animals (Scientific Procedures) Act and in this project licence are fulfilled.'
      }
    );

    assert.deepEqual(
      result.find(c => c.condition === 'CUSTOM'),
      {
        ...expectedProjectColumns,
        level: 'protocol',
        protocol_name: 'Protocol 2',
        type: 'condition',
        condition: 'CUSTOM',
        requires_editing: 'false',
        edited: '',
        content: 'Custom condition protocol 2'
      }
    );
  });
});
