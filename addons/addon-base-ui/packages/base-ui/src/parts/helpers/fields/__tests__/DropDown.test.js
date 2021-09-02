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

const options = [];

describe('DropDown', () => {
  let wrapper = null;
  let component = null;

  describe('getDefaultValue', () => {
    it('should get Encyption Key ARN', () => {
      // BUILD
      const field = {
        key: 'EncryptionKeyArn',
        value: 'encryptionkeyarn',
        sync: jest.fn(() => true),
        validate: jest.fn(() => true),
      };
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
      const field = {
        key: 'IamPolicyDocument',
        value: 'iampolicydocument',
        sync: jest.fn(() => true),
        validate: jest.fn(() => true),
      };
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
      const field = {
        key: 'AccessFromCIDRBlock',
        value: 'accessfromcidrblock',
        sync: jest.fn(() => true),
        validate: jest.fn(() => true),
      };
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
      const field = { key: 'VPC', value: 'vpc', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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
      const field = {
        key: 'EnvironmentInstanceFiles',
        value: 'environmentinstancefiles',
        sync: jest.fn(() => true),
        validate: jest.fn(() => true),
      };
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
      const field = { key: 'Subnet', value: 'subnet', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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
      const field = { key: 'S3Mounts', value: 's3mounts', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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
      const field = { key: 'Namespace', value: 'namespace', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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
      const field = { key: 'KeyName', value: 'keyname', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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
      const field = { key: 'Namespace', value: 'namespace', sync: jest.fn(() => true), validate: jest.fn(() => true) };
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

    it('should not prepopulate when the field has a key that does not match the option (i.e. not the config setup)', () => {
      // BUILD
      const field = {
        key: 'someKey',
        value: 'someFieldValue',
        sync: jest.fn(() => true),
        validate: jest.fn(() => true),
      };
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
