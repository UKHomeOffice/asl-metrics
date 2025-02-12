/**
 * run script like node named-person-data-export.js "pelh" "resolved" "2023-03-01" "2025-03-01"
 *
 * @param {string} role - role to filter by
 * @param {string} status - status to filter by
 * returns a CSV file with the following columns:
 * title, first_name, last_name, email, telephone, admin, roles, establishment_name, establishment_status, case_id, changed_by, case_status, model, model_status
 * */

const fs = require('fs');
const fastCsv = require('fast-csv');
const moment = require('moment');
const settings = require('../config');

const knexTaskflow = require('knex')({
  client: 'pg',
  connection: settings.workflowdb
});

const knexASL = require('knex')({
  client: 'pg',
  connection: settings.asldb
});

// Read CLI arguments safely
if (process.argv.length < 6) {
  console.error('Usage: node named-person-data-export.js <role> <status> <start_date> <end_date>');
  process.exit(1);
}
let [role, status, start, end] = process.argv.slice(2);

start = start + 'T00:00:00Z';
end = end + 'T23:59:59Z';
// Query DB ASL
async function getProfiles() {
  console.log(`\nQuery Parameters:
  - role: ${role}
  - status: ${status}
  - start Date: ${start}
  - end Date: ${end}\n`);
  return knexASL
    .select(
      'roles.profile_id',
      'p.title',
      'p.first_name',
      'p.last_name',
      'p.email',
      'p.telephone',
      knexASL.raw("CASE WHEN permissions.role = 'admin' THEN 1 ELSE 0 END AS admin"),
      knexASL.raw("STRING_AGG(DISTINCT roles.type, ', ') AS roles"),
      'establishments.name',
      'establishments.status'
    )
    .from('profiles AS p')
    .join('permissions', 'permissions.profile_id', 'p.id')
    .join('establishments', 'permissions.establishment_id', 'establishments.id')
    .leftJoin('roles', function () {
      this.on('roles.profile_id', '=', 'p.id').andOn(
        'roles.establishment_id',
        '=',
        'establishments.id'
      );
    })
    .where(function () {
      this.where('permissions.role', 'admin').orWhereNotNull('roles.id');
    })
    // process.argv[0] is the first argument passed to the script - role i.e "pelh, nvs"
    .andWhere('roles.type', role)
    .groupBy('establishments.id', 'p.id', 'permissions.role', 'roles.profile_id')
    .orderBy('p.last_name', 'asc')
    .orderBy('p.first_name', 'asc')
    .orderBy('establishments.name', 'asc');
}

// Query DB Taskflow
async function getActivityLogs() {
  return knexTaskflow
    .select(
      'cases.id AS case_id',
      'activity_log.changed_by',
      'cases.status',
      knexTaskflow.raw("cases.data->>'model' AS model"),
      knexTaskflow.raw("cases.data->'modelData'->>'status' AS model_status")
    )
    .from('cases')
    .join('activity_log', 'cases.id', 'activity_log.case_id');
}

async function getCases() {
  return knexTaskflow
    .select(
      'c.id AS case_id',
      'a_log.changed_by AS assigned_to',
      'c.status',
      knexTaskflow.raw("c.data->>'model' AS model"),
      knexTaskflow.raw("c.data->'modelData'->>'status' AS model_status")
    )
    .from({ c: 'cases' }) // Alias for cases table
    .join({ a_log: 'activity_log' }, 'c.id', 'a_log.case_id') // Join with activity_log
    .whereIn('c.status', [status]) // Status filter
    .whereBetween('c.updated_at', [
      moment(start).startOf('day').toISOString(),
      moment(end).endOf('day').toISOString()
    ]); // Fixed date range
}

// Merge Data
async function mergeAndSaveCSV() {
  try {
    const profiles = await getProfiles();
    console.log('Profiles from DB ASL:', profiles.length);

    const queryActivityLog = await getActivityLogs();
    console.log('Activity_Logs from DB Taskflow:', queryActivityLog.length);

    const queryCases = await getCases();
    console.log('Cases rom DB Taskflow::', queryCases.length);

    // Convert profiles array to an object for quick lookup
    const profileMap = profiles.reduce((acc, profile) => {
      acc[profile.profile_id] = profile;
      return acc;
    }, {});

    // Merge closed cases
    const mergedData = queryActivityLog
      .map((caseData) => ({
        ...profileMap[caseData.assigned_to], // Get profile data
        ...caseData // Add case data
      }))
      .filter((row) => row.profile_id); // Remove cases with no profile match

    // Merge open cases
    queryCases.forEach((caseData) => {
      if (profileMap[caseData.assigned_to]) {
        mergedData.push({
          ...profileMap[caseData.assigned_to],
          ...caseData
        });
      }
    });

    // Write to CSV
    const csvStream = fastCsv.format({ headers: true });
    const writableStream = fs.createWriteStream('merged_data.csv');

    writableStream.on('finish', () => {
      console.log('\nCSV file merged_data.csv created with', mergedData.length, 'rows');
    });

    csvStream.pipe(writableStream);
    mergedData.forEach((row) => csvStream.write(row));
    csvStream.end();
  } catch (error) {
    console.error('Error merging data:', error);
  } finally {
    console.log('Cleaning up...');
    await knexASL.destroy();
    await knexTaskflow.destroy();
  }
}

// Run the script
mergeAndSaveCSV();
