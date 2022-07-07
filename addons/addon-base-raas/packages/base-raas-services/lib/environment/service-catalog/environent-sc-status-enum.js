/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const environmentScStatus = {
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

  // Environment starting from a previously stopped state in progress or pending
  STARTING: 'STARTING',

  // Environment starting from a previously stopped state completed with errors
  STARTING_FAILED: 'STARTING_FAILED',

  // Environment stopping completed successfully
  STOPPED: 'STOPPED',

  // Environment stopping in progress or pending
  STOPPING: 'STOPPING',

  // Environment stopping from a previously stopped state completed with errors
  STOPPING_FAILED: 'STOPPING_FAILED',

  // Environment termination in progress or pending
  TERMINATING: 'TERMINATING',

  // Environment termination completed successfully
  TERMINATED: 'TERMINATED',

  // Environment termination completed with errors
  TERMINATING_FAILED: 'TERMINATING_FAILED',
};

module.exports = environmentScStatus;
