/**
 * run script like node named-person-data-export.js "pelh" "resolved"
 *
 * @param {string} role - role to filter by
 * @param {string} status - status to filter by
 * returns a CSV file with the following columns:
 * title, first_name, last_name, email, telephone, admin, roles, establishment_name, establishment_status, case_id, changed_by, case_status, model, model_status
 * */

const fs = require('fs');
const fastCsv = require('fast-csv');
const settings = require('../config');

const knexTaskflow = require('knex')({
  client: 'pg',
  connection: {
    host: settings.workflowdb.host,
    user: settings.workflowdb.user,
    password: settings.workflowdb.password,
    database: settings.workflowdb.database,
    port: settings.workflowdb.port
  }
});

const knexASL = require('knex')({
  client: 'pg',
  connection: {
    host: settings.asldb.host,
    user: settings.asldb.user,
    password: settings.asldb.password,
    database: settings.asldb.database,
    port: settings.asldb.port
  }
});

// Read CLI arguments
const [role, status] = process.argv.slice(2);
let statusArray = new Array(status);
// Query DB ASL
async function getProfiles() {
  console.log('Query for role:', role, '\n');
  console.log('Query for status:', statusArray, '\n');
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
      '2023-03-01T00:00:00Z',
      '2025-02-01T23:59:59Z'
    ]); // Fixed date range
}

// Merge Data
async function mergeAndSaveCSV() {
  try {
    const profiles = await getProfiles();
    console.log('Profiles from DB ASL:', profiles.length);

    const closedCases = await getActivityLogs();
    console.log('Activity_Logs from DB Taskflow:', closedCases.length);

    const openCases = await getCases();
    console.log('Cases rom DB Taskflow::', openCases.length);

    // Convert profiles array to an object for quick lookup
    const profileMap = profiles.reduce((acc, profile) => {
      acc[profile.profile_id] = profile;
      return acc;
    }, {});

    // Merge closed cases
    const mergedData = closedCases
      .map((caseData) => ({
        ...profileMap[caseData.assigned_to], // Get profile data
        ...caseData // Add case data
      }))
      .filter((row) => row.profile_id); // Remove cases with no profile match

    // Merge open cases
    openCases.forEach((caseData) => {
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
      console.log('\nCSV file created: merged_data.csv');
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
