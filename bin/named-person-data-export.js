#!/usr/bin/env node
/**
 * Extract data to CSV from ASL and Taskflow databases.
 * Run:  node named-person-data-export.js
 * --role="pelh"
 * --status="resolved"
 * --start="2020-01-01"
 * --end="2025-03-03"
 * --fileName="pelh_resolved.csv"
 *
 * @param {string} role - Role type (e.g. 'pelh')
 * @param {string} status - Case status (e.g. 'resolved')
 * @param {string} start - Start date (e.g. '2020-01-01')
 * @param {string} end - End date (e.g. '2025-03-03')
 * @param {string} fileName - Optional file name to save the CSV output, if not provided, it will stream to stdout.
 * @returns {CSV} - CSV file with the extracted data
 * */

const fs = require('fs');
const fastCsv = require('fast-csv');
const moment = require('moment');
const minimist = require('minimist');
const settings = require('../config');

const knexTaskflow = require('knex')({
  client: 'pg',
  connection: settings.workflowdb
});

const knexASL = require('knex')({
  client: 'pg',
  connection: settings.asldb
});

const args = minimist(process.argv.slice(2));

let { role, status, start, end, fileName } = args;

// Read CLI arguments safely
if (!role || !status || !start || !end) {
  console.error('Usage: node named-person-data-export.js <role> <status> <start> <end> [fileName]');
  console.error('Example: node bin/named-person-data-export.js --role="pelh" --status="resolved" --start="2020-01-01" --end="2025-03-03" --fileName="pelh_resolved.csv"');
  process.exit(1);
}

console.log(`\nQuery Parameters:
  - role: ${role}
  - status: ${status}
  - start Date: ${start}
  - end Date: ${end}\n`);

start = start + 'T00:00:00Z';
end = end + 'T23:59:59Z';

// Function to determine output stream
function getOutputStream(fileName) {
  if (fileName) {
    fileName = fileName.endsWith('.csv') ? 'named_person_'.concat(fileName) : `named_person_${fileName}.csv`;
    console.log(`Writing to file: ${fileName}`);
    return fs.createWriteStream(fileName);
  } else {
    console.log('Streaming CSV to stdout...');
    return process.stdout;
  }
}

// Function to chunk an array into smaller chunks
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Query DB ASL for profiles
async function getProfiles() {

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
    .andWhere('roles.type', role)
    .groupBy('establishments.id', 'p.id', 'permissions.role', 'roles.profile_id')
    .orderBy('p.last_name', 'asc')
    .orderBy('p.first_name', 'asc')
    .orderBy('establishments.name', 'asc');
}

// Query DB Taskflow - Activity logs with distinct changed_by
async function getActivityLogs(profileIds) {
  const chunks = chunkArray(profileIds, 100); // Adjust chunk size as needed
  let allActivityLogs = [];

  for (const chunk of chunks) {
    const chunkLogs = await knexTaskflow
      .select(
        'activity_log.case_id',
        'activity_log.changed_by'
      )
      .from('activity_log')
      .whereIn('activity_log.changed_by', chunk)
      .distinct('activity_log.case_id'); // Ensure distinct case_ids
    allActivityLogs = allActivityLogs.concat(chunkLogs);
  }

  return allActivityLogs;
}

// Query DB Taskflow - Cases based on case_id
async function getCases(caseIds) {
  return knexTaskflow
    .select(
      'c.id AS case_id',
      'c.status',
      knexTaskflow.raw("c.data->>'model' AS model"),
      knexTaskflow.raw("c.data->'modelData'->>'status' AS model_status")
    )
    .from({ c: 'cases' })
    .whereIn('c.id', caseIds) // Filter cases based on the case_id from activity_log
    .whereIn('c.status', [status]) // Filter by case status
    .whereBetween('c.updated_at', [
      moment(start).startOf('day').toISOString(),
      moment(end).endOf('day').toISOString()
    ]);
}

async function mergeAndSaveCSV() {
  try {
    // Fetch profiles based on role filter
    const profiles = await getProfiles();
    console.log('Profiles from DB ASL:', profiles.length);

    // Extract profile_ids for filtering activity logs
    const profileIds = profiles.map(profile => profile.profile_id);

    // Fetch activity logs based on the profile_ids
    const queryActivityLog = await getActivityLogs(profileIds);
    console.log('Activity Logs from DB Taskflow:', queryActivityLog.length);

    // Extract case_ids from activity logs
    const caseIds = [...new Set(queryActivityLog.map(log => log.case_id))]; // Remove duplicates

    // Fetch cases based on the extracted case_ids
    const queryCases = await getCases(caseIds);
    console.log('Cases from DB Taskflow:', queryCases.length);

    // Convert cases array to a map for quick lookup
    const casesMap = queryCases.reduce((acc, caseData) => {
      acc[caseData.case_id] = caseData;
      return acc;
    }, {});

    // Prepare the final result
    const result = [];

    // Keep track of cases already added per profile
    const profileCaseMap = new Map();

    profiles.forEach(profile => {
      // Ensure each profile only gets a case once, regardless of organization
      if (!profileCaseMap.has(profile.profile_id)) {
        profileCaseMap.set(profile.profile_id, new Set());
      }

      queryActivityLog.forEach(log => {
        if (log.changed_by === profile.profile_id) {
          const caseData = casesMap[log.case_id];

          if (caseData && !profileCaseMap.get(profile.profile_id).has(log.case_id)) {
            result.push({
              profile_id: profile.profile_id,
              roles: profile.roles,
              cases_status: caseData.status,
              title: profile.title,
              first_name: profile.first_name,
              last_name: profile.last_name,
              email: profile.email,
              telephone: profile.telephone,
              admin: profile.admin,
              establishment_status: profile.status,
              cases: caseData.case_id
            });

            profileCaseMap.get(profile.profile_id).add(log.case_id); // Prevent duplicate cases for this profile
          }
        }
      });
    });

    // Write to file or stdout
    const outputStream = getOutputStream(fileName);

    // Write the result to CSV
    const csvStream = fastCsv.format({
      headers: [
        'profile_id', 'roles', 'cases_status', 'title', 'first_name', 'last_name', 'email', 'telephone', 'admin', 'establishment_status', 'cases'
      ]
    });

    csvStream.pipe(outputStream);

    result.forEach(row => csvStream.write(row));
    csvStream.end();

    console.log('\nCSV output completed.');
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
