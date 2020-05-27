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

import { sessionStore } from '@aws-ee/base-ui/dist/models/SessionStore';

/**
 * A function that returns component's state (as MST model).
 * The function creates the component's state MST model if it doesn't exist in the SessionStore.
 *
 * @param uiStateModel The MST model containing the component's UI state
 * @param id The identifier string for the model
 * @param componentStateCreatorFn The function to create the component's state MST model if it doesn't exist in the SessionStore.
 * The default "componentStateCreatorFn" just uses the "create()" method of the given model to create initial state.
 *
 * @returns {*}
 */
function getComponentSessionState(uiStateModel, id, componentStateCreatorFn = (model) => model.create()) {
  const stateId = `${uiStateModel.name}-${id}`;
  const entry = sessionStore.get(stateId) || componentStateCreatorFn(uiStateModel);
  sessionStore.set(stateId, entry);
  return entry;
}

export default getComponentSessionState;
