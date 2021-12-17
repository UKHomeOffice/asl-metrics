const assert = require('assert');
const generateTask = require('../../helpers/generate-task');
const report = require('../../../lib/reports/internal-deadlines');

describe('Internal deadlines report', () => {
  beforeEach(() => {
    this.settings = {
      db: {},
      query: {
        start: '2021-12-01',
        end: '2021-12-31'
      }
    };

    this.report = report(this.settings);
  });

  describe('parse', () => {
    it('ignores open tasks that have no internal deadline set', () => {
      const task = generateTask({ createdAt: '2021-12-01' });
      task.history('with-inspectorate', 0);

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('ignores closed tasks that have no internal deadline set', () => {
      const task = generateTask({ createdAt: '2021-12-01' });
      task.history('with-inspectorate');
      task.history('resolved', 40); // 2022-02-01

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('ignores tasks with an internal deadline outside of the reporting period', () => {
      const createdAt = '2021-12-20';
      const internalDeadline = { standard: '2021-02-16', extended: '2021-03-09' };
      const task = generateTask({ createdAt, internalDeadline });
      task.history('with-inspectorate');
      task.history('resolved', 100); // 2022-05-16

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('ignores application tasks that were resolved before the internal deadline', () => {
      const createdAt = '2021-10-08';
      const internalDeadline = { standard: '2021-12-03', extended: '2021-12-24' };
      const task = generateTask({ createdAt, internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('resolved', 40);

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('ignores application tasks that were resolved before an extended internal deadline', () => {
      const createdAt = '2021-10-08';
      const internalDeadline = { standard: '2021-12-03', extended: '2021-12-24' };
      const deadline = { ...internalDeadline, isExtended: true }; // deadline was extended
      const task = generateTask({ createdAt, internalDeadline, deadline });

      task.history('with-inspectorate', 0);
      task.history('resolved', 45); // resolved after the standard deadline but before the extended deadline

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('returns application tasks that were resolved after the internal deadline', () => {
      const createdAt = '2021-10-08';
      const internalDeadline = { standard: '2021-12-03', extended: '2021-12-24' };
      const task = generateTask({ createdAt, internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('resolved', 41);

      const expected = {
        task_id: task.id,
        project_title: task.data.modelData.title,
        licence_number: task.data.modelData.licenceNumber,
        type: 'application',
        resubmitted: 'No',
        extended: 'No',
        still_open: 'No',
        target: '2021-12-03',
        resolved_at: '2021-12-06T00:00:00.000Z'
      };

      assert.deepEqual(this.report.parse(task), expected);
    });

    it('returns open application tasks that have passed the internal deadline', () => {
      const createdAt = '2021-10-08';
      const internalDeadline = { standard: '2021-12-03', extended: '2021-12-24' };
      const task = generateTask({ createdAt, internalDeadline });

      task.history('with-inspectorate', 0);

      const expected = {
        task_id: task.id,
        project_title: task.data.modelData.title,
        licence_number: task.data.modelData.licenceNumber,
        type: 'application',
        resubmitted: 'No',
        extended: 'No',
        still_open: 'Yes',
        target: '2021-12-03',
        resolved_at: undefined
      };

      assert.deepEqual(this.report.parse(task), expected);
    });

    it('ignores amendment tasks that were resolved before the internal deadline', () => {
      const internalDeadline = { standard: '2021-12-31' };
      const task = generateTask({ type: 'amendment', createdAt: '2021-12-01', internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('resolved', 20);

      const expected = null;
      assert.equal(this.report.parse(task), expected);
    });

    it('returns amendment tasks that were resolved after the internal deadline', () => {
      const internalDeadline = { standard: '2021-12-31' };
      const task = generateTask({ type: 'amendment', createdAt: '2021-12-01', internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('resolved', 21);

      const expected = {
        task_id: task.id,
        project_title: task.data.modelData.title,
        licence_number: task.data.modelData.licenceNumber,
        type: 'amendment',
        resubmitted: 'No',
        extended: 'No',
        still_open: 'No',
        target: '2021-12-31',
        resolved_at: '2022-01-04T00:00:00.000Z'
      };

      assert.deepEqual(this.report.parse(task), expected);
    });

    it('returns open amendment tasks that have passed the internal deadline', () => {
      const internalDeadline = { standard: '2021-12-31' };
      const task = generateTask({ type: 'amendment', createdAt: '2021-12-01', internalDeadline });

      task.history('with-inspectorate', 0);

      const expected = {
        task_id: task.id,
        project_title: task.data.modelData.title,
        licence_number: task.data.modelData.licenceNumber,
        type: 'amendment',
        resubmitted: 'No',
        extended: 'No',
        still_open: 'Yes',
        target: '2021-12-31',
        resolved_at: undefined
      };

      assert.deepEqual(this.report.parse(task), expected);
    });
  });

});
