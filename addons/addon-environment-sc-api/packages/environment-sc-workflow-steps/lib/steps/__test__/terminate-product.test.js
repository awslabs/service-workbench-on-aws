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

const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const TerminateProduct = require('../terminate-product/terminate-product');

describe('TerminateProduct', () => {
  const meta = {};
  const input = {};

  const tp = new TerminateProduct({
    step: { config: {} },
    workflowPayload: new WorkflowPayload({ meta, input, workflowInstance: {} }),
  });

  beforeAll(async () => {
    tp.payload = {
      getValue: value => {
        if (value === 'envId') {
          return 'abc';
        }
        return '';
      },
    };
  });

  describe('start', () => {
    it('deleteMainAccountEgressStoreRole should be called once if Egress Store is enabled', async () => {
      // BUILD
      const deleteMainAccountEgressStoreRole = jest.fn();
      mockDataEgressService(deleteMainAccountEgressStoreRole);
      mockEnableEgressStoreSettings(true);

      // OPERATE
      await tp.start();

      // CHECK
      expect(deleteMainAccountEgressStoreRole).toHaveBeenCalledTimes(1);
    });

    it('deleteMainAccountEgressStoreRole should NOT be called if Egress Store is disabled', async () => {
      // BUILD
      const deleteMainAccountEgressStoreRole = jest.fn();
      mockDataEgressService(deleteMainAccountEgressStoreRole);
      mockEnableEgressStoreSettings(false);

      // OPERATE
      await tp.start();

      // CHECK
      expect(deleteMainAccountEgressStoreRole).not.toHaveBeenCalled();
    });

    function mockDataEgressService(deleteMainAccountEgressStoreRole) {
      const dataEgressService = {};
      dataEgressService.deleteMainAccountEgressStoreRole = deleteMainAccountEgressStoreRole;
      tp.mustFindServices = jest.fn().mockImplementation(param => {
        if (param === 'dataEgressService') {
          return dataEgressService;
        }
        throw new Error('Unexpected service');
      });
    }

    function mockEnableEgressStoreSettings(isEnabled) {
      tp.settings = {
        getBoolean: key => {
          if (key === 'enableEgressStore') {
            return isEnabled;
          }
          throw new Error('Unexpected key');
        },
      };
    }
  });
});
