# asl-metrics

## Setup

If running locally, the database environment variables should be set in `.env` as per `asl-workflow`.

Additionally the following should be defined in `.env`:

```
PORT=8089
FLOW_URL=http://localhost:8083/flow
```

## Reports

The code for a report should consist of a function that receives the inbound request returns two methods: `query` and `parse`.

The inbound request object will be augmented with the following properties:

* `db` - an object containing two initialised `knex` objects: `db.asl` - a connection to the licence database; and `db.flow` - a connection to the workflow database.
* `flow` - a map of the available workflow statuses with attached metadata.

### `query`

The `query` function should return a `knex` query.

### `parse`

The `parse` function should represent an iterator function, which will be applied to each row returned from the database to form a row of the response.

The iterator can be synchronous or asynchronous.

If a single record from the database should result in multiple response rows then they can be returned as an array.

If a single record from the database should result in _no_ response rows then an empty array should be returned.

### Example

The following report would return the licence number and licence holder of all active PILs:

```js
module.exports = ({ db }) => {

  const query = () => {
    db.asl('pils')
      .select(
        'pils.licence_number',
        'profiles.*'
      )
      .leftjoin('profiles', 'pils.profile_id', 'profiles.id')
      .where({ 'pils.status': 'active' });
  };

  const parse = record => {
    return {
      licenceNumber: record.licence_number,
      licenceHolder: `${record.first_name} ${record.first_name}`
    };
  }

  return { query, parse };

};
```

## Streaming

By default reports return newline delimited json streams. A complete json object can be requested by passing a querystring parameter of `?stream=false`.

Note: sending complete responses is not recommended for large reports or reports which ingest large numbers of database records.
