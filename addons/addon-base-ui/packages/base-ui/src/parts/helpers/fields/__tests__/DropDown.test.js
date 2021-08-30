/* eslint-disable no-template-curly-in-string */
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

import React from 'react';
import { shallow } from 'enzyme';
import DropDown from '../DropDown';

const options = [
  { key: 'awsRegion', value: '${awsRegion}', text: '${awsRegion}' },
  { key: 'namespace', value: '${namespace}', text: '${namespace}' },
  { key: 'envId', value: '${envId}', text: '${envId}' },
  { key: 'envTypeId', value: '${envTypeId}', text: '${envTypeId}' },
  { key: 'envTypeConfigId', value: '${envTypeConfigId}', text: '${envTypeConfigId}' },
  { key: 'name', value: '${name}', text: '${name}' },
  { key: 'description', value: '${description}', text: '${description}' },
  { key: 'adminKeyPairName', value: '${adminKeyPairName}', text: '${adminKeyPairName}' },
  { key: 'accountId', value: '${accountId}', text: '${accountId}' },
  { key: 'projectId', value: '${projectId}', text: '${projectId}' },
  { key: 'indexId', value: '${indexId}', text: '${indexId}' },
  { key: 'cidr', value: '${cidr}', text: '${cidr}' },
  { key: 'vpcId', value: '${vpcId}', text: '${vpcId}' },
  { key: 'subnetId', value: '${subnetId}', text: '${subnetId}' },
  { key: 'encryptionKeyArn', value: '${encryptionKeyArn}', text: '${encryptionKeyArn}' },
  { key: 'xAccEnvMgmtRoleArn', value: '${xAccEnvMgmtRoleArn}', text: '${xAccEnvMgmtRoleArn}' },
  { key: 'externalId', value: '${externalId}', text: '${externalId}' },
  { key: 'studyIds', value: '${studyIds}', text: '${studyIds}' },
  { key: 's3Mounts', value: '${s3Mounts}', text: '${s3Mounts}' },
  { key: 'iamPolicyDocument', value: '${iamPolicyDocument}', text: '${iamPolicyDocument}' },
  { key: 'environmentInstanceFiles', value: '${environmentInstanceFiles}', text: '${environmentInstanceFiles}' },
  { key: 'uid', value: '${uid}', text: '${uid}' },
  { key: 'username', value: '${username}', text: '${username}' },
  { key: 'userNamespace', value: '${userNamespace}', text: '${userNamespace}' },
];

describe('DropDown', () => {
  let wrapper = null;
  let component = null;

  describe('getDefaultValue', () => {
    it('should get Encyption Key ARN', () => {
      // BUILD
      const field = { key: 'EncryptionKeyArn', value: 'encryptionkeyarn' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${encryptionKeyArn}');
    });

    it('should get IAM Policy Document', () => {
      // BUILD
      const field = { key: 'IamPolicyDocument', value: 'iampolicydocument' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${iamPolicyDocument}');
    });

    it('should get Access From CIDR Block', () => {
      // BUILD
      const field = { key: 'AccessFromCIDRBlock', value: 'accessfromcidrblock' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${cidr}');
    });

    it('should get VPC', () => {
      // BUILD
      const field = { key: 'VPC', value: 'vpc' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${vpcId}');
    });

    it('should get Environment Instance Files', () => {
      // BUILD
      const field = { key: 'EnvironmentInstanceFiles', value: 'environmentinstancefiles' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${environmentInstanceFiles}');
    });

    it('should get Subnet', () => {
      // BUILD
      const field = { key: 'Subnet', value: 'subnet' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${subnetId}');
    });

    it('should get S3 Mounts', () => {
      // BUILD
      const field = { key: 'S3Mounts', value: 's3mounts' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${s3Mounts}');
    });

    it('should get Namespace', () => {
      // BUILD
      const field = { key: 'Namespace', value: 'namespace' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${namespace}');
    });

    it('should get KeyName', () => {
      // BUILD
      const field = { key: 'KeyName', value: 'keyname' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();

      // OPERATE
      const defaultValue = component.getDefaultValue('', field);

      // CHECK
      expect(defaultValue).toBe('${adminKeyPairName}');
    });

    it('should not change a custom Namespace', () => {
      // BUILD
      const field = { key: 'Namespace', value: 'namespace' };
      wrapper = shallow(
        <DropDown key={field.key} field options={options} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();
      const myNamespace = 'myNamespace';

      // OPERATE
      const defaultValue = component.getDefaultValue(myNamespace, field);

      // CHECK
      expect(defaultValue).not.toBe('${namespace}');
      expect(defaultValue).toBe(myNamespace);
    });

    it('should not prepopulate when the field has no key attribute', () => {
      // the method would try to do things to undefined variables if there is no key attribute
      // in the field
      // BUILD
      const field = { name: 'someField', value: 'someFieldValue' };
      wrapper = shallow(<DropDown field options={options} disabled search selection fluid allowAdditions clearable />);
      component = wrapper.instance();
      const someValue = 'someValue';

      // OPERATE
      const defaultValue = component.getDefaultValue(someValue, field);

      // CHECK
      expect(defaultValue).toBe(someValue);
    });

    it('should not prepopulate when the field has no key attribute even though value passed is empty', () => {
      // the method would try to do things to undefined variables if there is no key attribute
      // in the field
      // BUILD
      const field = { name: 'someField', value: 'someFieldValue' };
      wrapper = shallow(<DropDown field options={options} disabled search selection fluid allowAdditions clearable />);
      component = wrapper.instance();
      const someValue = '';

      // OPERATE
      const defaultValue = component.getDefaultValue(someValue, field);

      // CHECK
      expect(defaultValue).toBe(someValue);
    });

    it('should not prepopulate when the options has no key attribute', () => {
      // the method would try to do things to undefined variables if there is no key attribute
      // in the options list's elements
      // BUILD
      const field = { key: 'someKey', value: 'someFieldValue' };
      const noKeyOption = [{ name: 'someField' }];
      wrapper = shallow(
        <DropDown field options={noKeyOption} disabled search selection fluid allowAdditions clearable />,
      );
      component = wrapper.instance();
      const someValue = 'someValue';

      // OPERATE
      const defaultValue = component.getDefaultValue(someValue, field);

      // CHECK
      expect(defaultValue).toBe(someValue);
    });

    it('should not prepopulate when the options is empty', () => {
      // BUILD
      const field = { key: 'someKey', value: 'someFieldValue' };
      // const noKeyOption = [{ name: 'someField' }];
      wrapper = shallow(<DropDown field options={[]} disabled search selection fluid allowAdditions clearable />);
      component = wrapper.instance();
      const someValue = 'someValue';

      // OPERATE
      const defaultValue = component.getDefaultValue(someValue, field);

      // CHECK
      expect(defaultValue).toBe(someValue);
    });

    it('should not prepopulate when the field has a key that does not match the option (i.e. not the config setup)', () => {
      // BUILD
      const field = { key: 'someKey', value: 'someFieldValue' };
      wrapper = shallow(<DropDown field options={options} disabled search selection fluid allowAdditions clearable />);
      component = wrapper.instance();
      const someValue = 'someValue';

      // OPERATE
      const defaultValue = component.getDefaultValue(someValue, field);

      // CHECK
      expect(defaultValue).toBe(someValue);
    });
  });
});
