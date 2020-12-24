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

/**
 * Returns a json object that represents the cfn role resource as described in
 * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html
 *
 * In this case, this role is going to be used by the SWB application to check the status of the stack and be able
 * to get back the template id for the stack that is being installed.
 *
 * The output shape is
 * {
 *   'logicalId': <logical id>,
 *   'resource': {
 *    {
 *      "Type" : "AWS::IAM::Role",
 *      "Properties" : {
 *        "RoleName" : String,
 *        "AssumeRolePolicyDocument" : Json,
 *        "Description" : String,
 *        "Policies" : [ Policy, ... ],
 *      }
 *    }
 * }
 *
 * @param dsAccountEntity The data source account entity
 */
function toAppStackCfnResource(dsAccountEntity, swbMainAccountId) {
  const { id, qualifier, stack, mainRegion } = dsAccountEntity;

  const name = `${qualifier}-app-role-stack`;
  // cfn logical id can not have '-'
  const logicalId = `AppRoleStack${_.replace(qualifier, /-/g, '')}`;
  return {
    logicalId,
    resource: {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: name,
        AssumeRolePolicyDocument: toTrustPolicyDoc(swbMainAccountId),
        Description: 'An application role that allows the SWB application to check the status of the stack',
        Policies: [
          {
            PolicyName: 'swb-app-role-stack-essentials',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'CfnRelated',
                  Effect: 'Allow',
                  Action: ['cloudformation:DescribeStacks', 'cloudformation:ListStackResources'],
                  Resource: [`arn:aws:cloudformation:${mainRegion}:${id}:stack/${stack}/*`],
                },
              ],
            },
          },
        ],
      },
    },
  };
}

// @private
function toTrustPolicyDoc(swbMainAccountId) {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: swbMainAccountId },
        Action: ['sts:AssumeRole'],
      },
    ],
  };
}

module.exports = {
  toAppStackCfnResource,
};
