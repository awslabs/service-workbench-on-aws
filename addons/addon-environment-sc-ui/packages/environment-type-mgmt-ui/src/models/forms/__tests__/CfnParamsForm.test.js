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

import { getCfnParamsForm } from '../CfnParamsForm';

jest.mock('@aws-ee/base-ui/dist/helpers/form');
const formMock = require('@aws-ee/base-ui/dist/helpers/form');

describe('CfnParamsForm', () => {
  const param1 = { ParameterKey: 'key1', Description: 'desc1', DefaultValue: 'default1' };
  const param2 = { ParameterKey: 'key2', Description: 'desc2', DefaultValue: 'default2' };
  let defaultParams = null;
  let defaultFields = null;
  const expectedForm = 'testForm';

  beforeEach(async () => {
    defaultParams = [param1, param2];
    defaultFields = {
      key1: {
        label: param1.ParameterKey,
        extra: { explain: param1.Description },
        value: param1.DefaultValue,
        rules: 'required',
      },
      key2: {
        label: param2.ParameterKey,
        extra: { explain: param2.Description },
        value: param2.DefaultValue,
        rules: 'required',
      },
    };

    formMock.createForm = jest.fn(() => {
      return expectedForm;
    });
  });

  afterEach(async () => {
    formMock.createForm.mockReset();
  });

  it('should return all fields when AppStream is enabled and no CIDR config present', async () => {
    // BUILD
    process.env.REACT_APP_IS_APP_STREAM_ENABLED = true;

    // OPERATE
    const returnedForm = getCfnParamsForm(defaultParams, []);

    // CHECK
    expect(returnedForm).toBe(expectedForm);
    expect(formMock.createForm).toHaveBeenCalledTimes(1);
    expect(formMock.createForm).toHaveBeenCalledWith(defaultFields);
  });

  it('should return all fields when AppStream is disabled and no CIDR config present', async () => {
    // BUILD
    process.env.REACT_APP_IS_APP_STREAM_ENABLED = false;

    // OPERATE
    const returnedForm = getCfnParamsForm(defaultParams, []);

    // CHECK
    expect(returnedForm).toBe(expectedForm);
    expect(formMock.createForm).toHaveBeenCalledTimes(1);
    expect(formMock.createForm).toHaveBeenCalledWith(defaultFields);
  });

  it('should return default values correctly', async () => {
    // BUILD
    const overwriteParam2 = { ParameterKey: 'key2', Description: 'desc2', DefaultValue: 'newDefault2' };
    const params = [param1, overwriteParam2];
    const newFields = JSON.parse(JSON.stringify(defaultFields));
    newFields.key2.value = overwriteParam2.DefaultValue;

    // OPERATE
    const returnedForm = getCfnParamsForm(params, []);

    // CHECK
    expect(returnedForm).toBe(expectedForm);
    expect(formMock.createForm).toHaveBeenCalledTimes(1);
    expect(formMock.createForm).toHaveBeenCalledWith(newFields);
  });

  it('should not return cidr field when AppStream is enabled and CIDR config present', async () => {
    // BUILD
    process.env.REACT_APP_IS_APP_STREAM_ENABLED = true;
    const param3 = { ParameterKey: 'AccessFromCIDRBlock', Description: 'cidr', DefaultValue: '0.0.0.0/32' };
    const paramsWithCidr = [...defaultParams];
    paramsWithCidr.push(param3);

    // OPERATE
    const returnedForm = getCfnParamsForm(paramsWithCidr, []);

    // CHECK
    expect(returnedForm).toBe(expectedForm);
    expect(formMock.createForm).toHaveBeenCalledTimes(1);
    expect(formMock.createForm).toHaveBeenCalledWith(defaultFields);
  });

  it('should return all fields including cidr field when AppStream is disabled and CIDR config present', async () => {
    // BUILD
    process.env.REACT_APP_IS_APP_STREAM_ENABLED = false;
    const param3 = { ParameterKey: 'AccessFromCIDRBlock', Description: 'cidr', DefaultValue: '0.0.0.0/32' };
    const paramsWithCidr = [...defaultParams];
    paramsWithCidr.push(param3);
    const fieldsWithCidr = JSON.parse(JSON.stringify(defaultFields));
    fieldsWithCidr.AccessFromCIDRBlock = {
      label: param3.ParameterKey,
      extra: { explain: param3.Description },
      value: param3.DefaultValue,
      rules: 'required',
    };

    // OPERATE
    const returnedForm = getCfnParamsForm(paramsWithCidr, []);

    // CHECK
    expect(returnedForm).toBe(expectedForm);
    expect(formMock.createForm).toHaveBeenCalledTimes(1);
    expect(formMock.createForm).toHaveBeenCalledWith(fieldsWithCidr);
  });

  describe('should not return these fields if present in the CFN template: IsAppStreamEnabled, EgressStoreIamPolicyDocument, SolutionNamespace', () => {
    const isAppStreamEnabledParam = {
      ParameterKey: 'IsAppStreamEnabled',
      Description: 'Enable AppStream',
      DefaultValue: 'false',
    };

    const egressStoreIamPolicyDocumentParam = {
      ParameterKey: 'EgressStoreIamPolicyDocument',
      Description: 'Policy for egress store',
    };

    const solutionNamespaceParam = {
      ParameterKey: 'SolutionNamespace',
      Description: 'Namespace provided when onboarding your account',
    };
    it('AppStream Enabled', () => {
      process.env.REACT_APP_IS_APP_STREAM_ENABLED = true;
      runTest();
    });

    it('AppStream Disabled', () => {
      process.env.REACT_APP_IS_APP_STREAM_ENABLED = false;
      runTest();
    });

    function runTest() {
      // BUILD
      const params = [
        ...defaultParams,
        isAppStreamEnabledParam,
        egressStoreIamPolicyDocumentParam,
        solutionNamespaceParam,
      ];
      const fields = JSON.parse(JSON.stringify(defaultFields));
      // OPERATE
      const returnedForm = getCfnParamsForm(params, []);

      // CHECK
      expect(returnedForm).toBe(expectedForm);
      expect(formMock.createForm).toHaveBeenCalledTimes(1);
      expect(formMock.createForm).toHaveBeenCalledWith(fields);
    }
  });
});
