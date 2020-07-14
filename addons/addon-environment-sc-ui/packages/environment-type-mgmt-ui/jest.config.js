// jest.config.js
module.exports = {
  // verbose: true,
  notify: false,
  testEnvironment: 'node',
  // testPathIgnorePatterns: ['service.test.js'],
  // Configure JUnit reporter as CodeBuild currently only supports JUnit or Cucumber reports
  // See https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html
  reporters: ['default', ['jest-junit', { suiteName: 'jest tests', outputDirectory: './.build/test' }]],
};
