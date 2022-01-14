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
        resolved_at: '2021-12-06T00:00:01.003Z'
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
        resolved_at: '2022-01-04T00:00:01.003Z'
      };

      assert.deepEqual(this.report.parse(task), expected);
    });

    it('ignores amendment tasks that were resubmitted and resolved after the initial deadline but before the resubmission deadline', () => {
      const internalDeadline = { standard: '2021-12-31' };
      const task = generateTask({ type: 'amendment', createdAt: '2021-12-01', internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('returned-to-applicant', 10); // returned after 10 days (inside deadline)
      task.history('with-inspectorate', 15, true); // resubmitted after 25 days (new 15 day deadline)
      task.history('resolved', 10);

      const expected = null;
      assert.deepEqual(this.report.parse(task), expected);
    });

    it('returns amendment tasks that were returned after the initial deadline but then resolved before the resubmission deadline', () => {
      const internalDeadline = { standard: '2021-12-31' };
      const task = generateTask({ type: 'amendment', createdAt: '2021-12-01', internalDeadline });

      task.history('with-inspectorate', 0);
      task.history('returned-to-applicant', 25); // returned after 25 days (outside deadline)
      task.history('with-inspectorate', 5, true); // resubmitted after 30 days (new 15 day deadline)
      task.history('resolved', 10); // resolved within the new deadline

      const expected = {
        task_id: task.id,
        project_title: task.data.modelData.title,
        licence_number: task.data.modelData.licenceNumber,
        type: 'amendment',
        resubmitted: 'Yes',
        extended: 'No',
        still_open: 'No',
        target: '2021-12-31',
        resolved_at: '2022-01-31T00:00:01.010Z'
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
