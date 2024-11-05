module.exports = {
  port: process.env.PORT || 8080,
  verboseErrors: process.env.VERBOSE_ERRORS === 'true',
  flowUrl: process.env.FLOW_URL,
  workflowdb: {
    database: process.env.DATABASE_NAME || 'taskflow',
    host: process.env.DATABASE_HOST,
    password: process.env.DATABASE_PASSWORD || 'test-password',
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USERNAME || 'postgres'
  },
  asldb: {
    database: process.env.ASL_DATABASE_NAME || 'asl',
    host: process.env.ASL_DATABASE_HOST,
    password: process.env.ASL_DATABASE_PASSWORD || 'test-password',
    port: process.env.ASL_DATABASE_PORT,
    user: process.env.ASL_DATABASE_USERNAME || 'postgres',
    application_name: 'metrics'
  },
  auth: {
    realm: process.env.KEYCLOAK_REALM,
    url: process.env.KEYCLOAK_URL,
    client: process.env.KEYCLOAK_CLIENT,
    secret: process.env.KEYCLOAK_SECRET
  }
};
