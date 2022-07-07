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

import { types, applySnapshot, getEnv } from 'mobx-state-tree';

// ====================================================================================================================================
// EnvTypeConfigVar
// ====================================================================================================================================
const EnvTypeConfigVar = types
  .model('EnvTypeConfigVar', {
    name: '',
    desc: '',
  })
  .actions(self => ({
    setEnvTypeConfigVar(envTypeConfigVar) {
      applySnapshot(self, envTypeConfigVar);
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },
  }));

export default EnvTypeConfigVar;
export { EnvTypeConfigVar };
