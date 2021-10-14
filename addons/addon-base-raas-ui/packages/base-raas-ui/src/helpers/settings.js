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
/* eslint-disable import/prefer-default-export */
const enableBuiltInWorkspaces = process.env.REACT_APP_ENABLE_BUILT_IN_WORKSPACES === 'true';
const enableEgressStore = process.env.REACT_APP_ENABLE_EGRESS_STORE === 'true';
const isAppStreamEnabled = process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true';

export { enableBuiltInWorkspaces, enableEgressStore, isAppStreamEnabled };
