/**
 * Guard rail: tests delete data. Refuse to run against anything that is not
 * clearly a test database (e.g. a DATABASE_URL accidentally pointing at dev or prod).
 */
export function assertTestDatabaseUrl(databaseUrl: string): void {
  let databaseName = '';
  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    // fall through to the error below
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: database name must end with "_test" (got "${databaseName || 'invalid URL'}"). ` +
        'Set TEST_DATABASE_URL in .env.',
    );
  }
}
