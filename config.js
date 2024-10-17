module.exports = {
  port: process.env.PORT || 8089,
  verboseErrors: process.env.VERBOSE_ERRORS === 'true',
  flowUrl: process.env.FLOW_URL || 'http://localhost:8083',
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
    realm: process.env.KEYCLOAK_REALM || 'Asl-dev',
    url: process.env.KEYCLOAK_URL || 'https://sso-dev.notprod.homeoffice.gov.uk/auth',
    client: process.env.KEYCLOAK_CLIENT || 'asl-dev-connect',
    secret: process.env.KEYCLOAK_SECRET || 'dac82159-c85c-49ed-b268-abb1b916e53b'
  }
};
