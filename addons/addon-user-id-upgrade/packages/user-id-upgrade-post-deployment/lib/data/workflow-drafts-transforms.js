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
const _ = require('lodash');

const { parseAttributeValue, toStringAttributeValue } = require('../utils/attribute-value');
const { convertValue, statuses, deleteProp, singleValue } = require('../helpers/transforms');

// Add uid prop using created by prop
const addUid = (uidLookup, item, logger) => {
  const rawValue = item.createdBy; // We treat the createdBy as the owner of the workflow draft
  if (_.isUndefined(rawValue)) {
    logger.log({ value: rawValue, status: statuses.noUsernameFound });
    return;
  }

  const owner = convertValue(uidLookup, rawValue, logger);
  item.uid = owner;
};

// Looks inside the item.workflow for createdBy and updatedBy and confirm them
const updateWorkflow = (uidLookup, item, logger) => {
  const workflow = _.get(item, 'workflow.M');
  if (_.isUndefined(workflow)) return;
  const updatedByTransform = singleValue('updatedBy');
  const createdByTransform = singleValue('createdBy');

  updatedByTransform(uidLookup, workflow, logger);
  createdByTransform(uidLookup, workflow, logger);
};

// This function assumes that the addUid was already used
// It rebuilds the id string to '<uid>_<workflowId>_<workflowVer>'
const updateId = (uidLookup, item, logger) => {
  const rawUid = item.uid;
  const rawWorkflowId = item.workflowId;
  const rawWorkflowVer = item.workflowVer;

  if (_.isUndefined(rawUid) || _.isUndefined(rawWorkflowId) || _.isUndefined(rawWorkflowVer)) {
    logger.log({ value: [rawUid, rawWorkflowId, rawWorkflowVer], status: statuses.incorrectFormat });
    return;
  }

  const uid = parseAttributeValue(rawUid);
  const workflowId = parseAttributeValue(rawWorkflowId);
  const workflowVer = parseAttributeValue(rawWorkflowVer);
  const id = `${uid}_${workflowId}_${workflowVer}`;

  item.id = toStringAttributeValue(id);
};

module.exports = [addUid, updateWorkflow, updateId, deleteProp('username')];
