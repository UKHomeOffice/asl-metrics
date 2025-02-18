/**
 * Script to export named person data from Taskflow DB and save it as a CSV.
 *
 * Usage:
 *   node scripts/named-person-data-export.js [--startDate=YYYY-MM-DD] [--endDate=YYYY-MM-DD] [--file=output.csv]
 *
 * Options:
 *   @param {string} [--startDate=YYYY-MM-DD] - (Optional) Start date for filtering cases.
 *                                             Defaults to January 1st of the previous year.
 *   @param {string} [--endDate=YYYY-MM-DD]   - (Optional) End date for filtering cases.
 *                                             Defaults to December 31st of the current year.
 *   @param {string} [--file=output.csv]      - (Optional) Name of the output CSV file.
 *                                             Defaults to stdout (prints to console).
 *
 * Example:
 *   node scripts/named-person-data-export.js --startDate=2019-01-01 --endDate=2025-02-28 --file=output.csv
 *
 * Logs:
 *   - Prints the parameters passed or defaults used.
 *   - Outputs the number of rows written to the file.
 *   - Displays errors along with the correct usage instructions if incorrect parameters are provided.
 */

const fs = require('fs');
const fastCsv = require('fast-csv');
const settings = require('../config');
const knexTaskflow = require('knex')({
  client: 'pg',
  connection: settings.workflowdb
});
const knexASL = require('knex')({
  client: 'pg',
  connection: settings.asldb
});
const moment = require('moment');
const minimist = require('minimist');

// Parse command-line arguments
const args = minimist(process.argv.slice(2));

// Get the current year and last year
const currentYear = moment().year();
const lastYear = currentYear - 1;

// Default start and end dates
const startDate = args.startDate || `${lastYear}-01-01`;
const endDate = args.endDate || `${currentYear}-12-31`;
const fileName = args.file;

// Batch size for querying profiles
const BATCH_SIZE = 100;

// Log parameters
console.log(`Parameters received:`);
console.log(`Start Date: ${startDate}`);
console.log(`End Date: ${endDate}`);
console.log(`File Name: ${fileName}`);

// Function to determine output stream
function getOutputStream(fileName) {
  if (fileName) {
    // Ensure the file name ends with .csv and append 'named_person' to it
    const formattedFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
    const finalFileName = formattedFileName.replace('.csv', '-named-person-data.csv');
    console.log(`Writing to file: ${finalFileName}`);
    return fs.createWriteStream(finalFileName); // Create a write stream to the specified file
  } else {
    console.log('Streaming CSV to stdout...');
    return process.stdout;
  }
}

// Function to get profile details from ASL DB in batches
async function getProfilesByIds(profileIds) {
  const profiles = [];
  for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
    const batch = profileIds.slice(i, i + BATCH_SIZE);
    const batchProfiles = await knexASL('profiles')
      .select('id', 'title', 'first_name', 'last_name')
      .whereIn('id', batch);
    profiles.push(...batchProfiles);
  }
  return profiles;
}

// Function to get establishment details from ASL DB in batches
async function getEstablishmentsByIds(establishmentIds) {
  const establishments = [];
  for (let i = 0; i < establishmentIds.length; i += BATCH_SIZE) {
    const batch = establishmentIds.slice(i, i + BATCH_SIZE);
    const batchEstablishments = await knexASL('establishments')
      .select('id', 'name')
      .whereIn('id', batch);
    establishments.push(...batchEstablishments);
  }
  return establishments;
}

// Function to format time in the style of SQL query console
function formatTimeTaken(seconds) {
  const years = Math.floor(seconds / (365 * 24 * 60 * 60));
  const months = Math.floor((seconds % (365 * 24 * 60 * 60)) / (30 * 24 * 60 * 60));
  const days = Math.floor((seconds % (30 * 24 * 60 * 60)) / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  return `${years} years ${months} mons ${days} days ${hours} hours ${minutes} mins ${secs}.${Math.floor((seconds % 1) * 1000000)} secs`;
}

// Function to export data to CSV with establishment names mapped as you did for named_persons
async function exportToCsv(startDate, endDate) {
  try {
    // Define the start and end dates in ISO format
    const start = moment(startDate).startOf('day').toISOString();
    const end = moment(endDate).endOf('day').toISOString();

    // Determine the output stream using the helper function
    const outputStream = getOutputStream(fileName);
    const csvStream = fastCsv.format({ headers: true });
    csvStream.pipe(outputStream);

    // Query the Taskflow DB for the relevant data (fetching profileIds and establishment_ids)
    const results = await knexTaskflow.raw(`
        WITH applicants AS (
            SELECT
                case_id,
                event->'meta'->'user'->'profile'->>'name' AS applicant
            FROM activity_log
            WHERE event_name = 'create'
        ),
             inspectors AS (
                 SELECT
                     case_id,
                     event->'meta'->'user'->'profile'->>'name' AS inspector
                 FROM activity_log
                 WHERE event->>'event' LIKE 'status:with-inspectorate:%'
             )
        SELECT
            c.id AS case_id,
            STRING_AGG(DISTINCT a.event->'data'->'data'->>'profileId', ', ') AS named_persons,
            STRING_AGG(DISTINCT ap.applicant, ', ') AS applicants,
            STRING_AGG(DISTINCT ins.inspector, ', ') AS inspectors,
            c.status,
            c.data->'data'->>'type' AS role,
            c.data->'data'->>'establishmentId' AS establishment_id,
            c.created_at,
            c.updated_at,
            (c.updated_at - c.created_at) AS time_taken,
            COUNT(DISTINCT CASE
                               WHEN a.event_name = 'status:with-inspectorate:returned-to-applicant' THEN a.id
                               ELSE NULL
                END) + 1 AS application_iteration_count,
            STRING_AGG(DISTINCT a.comment, ', new-comment: ') AS unique_comments
        FROM cases c
                 INNER JOIN activity_log a ON c.id = a.case_id
                 LEFT JOIN applicants ap ON c.id = ap.case_id
                 LEFT JOIN inspectors ins ON c.id = ins.case_id
        WHERE c.data->>'model' = 'role'
          AND c.status IN ('returned-to-applicant', 'resolved', 'refused', 'rejected', 'with-inspectorate')
          AND c.updated_at BETWEEN ? AND ?
        GROUP BY c.id, c.status, c.data->'data'->>'type', c.data->'data'->>'establishmentId', c.created_at, c.updated_at;
    `, [start, end]);

    // Check if there is any data to process
    if (results.rows.length === 0) {
      console.log('No data returned from the query');
      return;
    }

    // Collect all profile IDs and establishment IDs from the query results
    const allProfileIds = [];
    const allEstablishmentIds = [];
    results.rows.forEach(row => {
      const profileIds = row.named_persons.split(', ');
      allProfileIds.push(...profileIds);
      if (row.establishment_id) {
        allEstablishmentIds.push(row.establishment_id);
      }
    });

    // Get profiles by profileIds in batches
    const profiles = await getProfilesByIds(allProfileIds);
    const profilesMap = profiles.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});

    // Get establishments by establishmentIds in batches
    const establishments = await getEstablishmentsByIds(allEstablishmentIds);
    const establishmentsMap = establishments.reduce((acc, establishment) => {
      acc[establishment.id] = establishment.name;
      return acc;
    }, {});

    // Process rows and write to CSV
    results.rows.forEach(row => {
      const profileIds = row.named_persons.split(', ');

      // Map profile IDs to full profile names
      const updatedNamedPersons = profileIds
        .map(id => {
          const profile = profilesMap[id];
          return profile ? `${profile.title} ${profile.first_name} ${profile.last_name}` : `Unknown (${id})`;
        })
        .join(', ');

      row.named_persons = updatedNamedPersons;

      // Map establishment_id to the establishment name
      const establishmentName = establishmentsMap[row.establishment_id] || row.establishment_id || `Unknown (${row.establishment_id})`;
      row.establishment_id = establishmentName; // Directly replace the establishment_id with the name

      // Format time_taken (in seconds) to a more detailed format
      const timeTakenInSeconds = moment(row.updated_at).diff(moment(row.created_at), 'seconds');
      row.time_taken = formatTimeTaken(timeTakenInSeconds);

      // Write the updated row to the CSV (this writes to the output stream)
      csvStream.write(row);
    });
    console.log(`Rows written to file: ${results.rows.length}`);

    // Close the CSV stream when all data has been written
    csvStream.end();
    console.log('CSV export completed successfully!');
  } catch (error) {
    console.error('Error occurred while exporting to CSV:', error);
    console.log('Correct way to trigger the script:');
    console.log('node named-person-data-export.js --startDate=2019-01-01 --endDate=2025-02-28 --file=output.csv');
  } finally {
    // Clean up and close DB connections
    knexTaskflow.destroy().finally(() => {
      console.log('Taskflow DB connection closed');
    });

    knexASL.destroy().finally(() => {
      console.log('ASL DB connection closed');
    });
  }
}

// Call the export function with the passed arguments or defaults
exportToCsv(startDate, endDate);
