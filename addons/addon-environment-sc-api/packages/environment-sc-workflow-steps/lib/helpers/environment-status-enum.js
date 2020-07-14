const environmentStatus = {
  // Environment provisioning in progress or pending
  PENDING: 'PENDING',

  // Stable state, ready to perform any operation. The stack has completed the requested operation
  // but is not exactly what was requested. For example, a request to update to a new version failed and the stack
  // rolled back to the current version.
  TAINTED: 'TAINTED',

  // Environment provisioning completed with errors
  FAILED: 'FAILED',

  // Environment provisioning completed successfully and is available for use
  COMPLETED: 'COMPLETED',

  // Environment termination in progress or pending
  TERMINATING: 'TERMINATING',

  // Environment termination completed successfully
  TERMINATED: 'TERMINATED',

  // Environment termination completed with errors
  TERMINATING_FAILED: 'TERMINATING_FAILED',
};

module.exports = environmentStatus;
