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

const HelloService = require('../hello/hello-service');
/**
 * Function to register solution specific services to the services container
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerServices(container, pluginRegistry) {
  // This is where you can register your services
  // Example:
  container.register('helloService', new HelloService());
  // container.register('service2', new Service2());
}

/**
 * Function to register solution specific static settings. "static settings" is a plain JavaScript object containing
 * settings as key/value. In Lambda environment, the settings are provided by environment variables.
 * There is 4K limit to the env variables that can be passed to a Lambda. The default settings service impl provided by the
 * "@aws-ee/base-services" package reads settings from env variables.
 * In addition to those, any other settings that be derived via convention should be passed as "static settings" to
 * avoid occupying space in env variables space.
 *
 * @param existingStaticSettings An existing static settings plain javascript object containing settings as key/value contributed by other plugins
 * @param settingsService Default instance of settings service that resolves settings from environment variables
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} A promise that resolves to static settings object
 */
// eslint-disable-next-line no-unused-vars
function getStaticSettings(existingStaticSettings, settingsService, pluginRegistry) {
  // This is where you can
  // 1. register your static settings, to register your static settings
  //
  //        const staticSettings = {
  //            ...existingStaticSettings,
  //            // add other static settings here as follows
  //            'staticSetting1':'static-setting-1-value',
  //            'staticSetting2':'static-setting-2-value',
  //          }
  //        return staticSettings;
  //
  // 2. modify any static settings
  //       existingStaticSettings['the-existing-static-setting-you-want-to-replace'] = 'new-value';
  //       return existingStaticSettings;
  //
  // 3. delete any existing static setting, to delete existing static setting
  //
  //      existingStaticSettings.delete('the-existing-static-setting-you-want-to-delete');
  //

  // TODO: Register additional static settings as per your solution requirements here
  const staticSettings = {
    ...existingStaticSettings,
  };
  // DO NOT forget to return staticSettings here. If you do not return here no static settings will be configured
  return staticSettings;
}

/**
 * Function to register solution specific logging context. "logging context" is a plain JavaScript object containing
 * key/values. These key/values are automatically added to logs by the loggingService.
 * These additional context items can be useful for debugging and monitoring especially when aggregating logs from
 * multiple lambdas, across multiple environments into a single dashboard or log analytics environment such as ELK stack.
 *
 * @param existingLoggingContext An existing logging context plain javascript object containing logging context items as key/value(s)
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} A promise that resolves to logging context object
 */
// eslint-disable-next-line no-unused-vars
async function getLoggingContext(existingLoggingContext, pluginRegistry) {
  // This is where you can
  // 1. register your logging context items, to register your logging context items
  //
  //        const loggingContext = {
  //            ...existingLoggingContext,
  //
  //            // add other items here as follows, for example,
  //            'someKey':'someValue',
  //          }
  //        return loggingContext;
  //
  // 2. modify any logging context items
  //       existingLoggingContext['the-existing-logging-context-item-you-want-to-replace'] = 'new-value';
  //       return existingLoggingContext;
  //
  // 3. delete any existing logging context, to delete existing logging context item
  //
  //      existingLoggingContext.delete('the-existing-logging-context-item-you-want-to-delete');
  //

  // TODO: Register additional logging context items as per your solution requirements here
  const loggingContext = {
    ...existingLoggingContext,
  };

  // DO NOT forget to return loggingContext here. If you do not return here no logging context will be configured
  return loggingContext;
}

/**
 * Function to add solution specific fields for masking in logs.
 * "fields to mask" is an array containing field names to mask in logs. The logingService will mask these fields as
 * '****' in logs. The service will look for these fields in deeply nested objects too. Note that the masking only works
 * when logging JavaScript objects.
 *
 * For example, let's say you want to mask "ssn" numbers from the logs so the fields to mask is ['ssn'].
 *
 * const objToLog = { key1: 'value1', ssn:'some-ssn'}
 * this.log.info(objToLog); // The ssn will be masked here
 *
 * const objWithNestedSsn = { key1: 'value1', nested: { deepNested: {'ssn':'some-ssn-value'}}}
 * this.log.info(objWithNestedSsn); // The ssn will be masked here as well
 *
 * but
 *
 * this.log.info(`value of ssn is ${someSssn}`); // The ssn will NOT be masked here
 *
 * These additional context items can be useful for debugging and monitoring especially when aggregating logs from
 * multiple lambdas, across multiple environments into a single dashboard or log analytics environment such as ELK stack.
 *
 * @param existingFieldsToMask An existing array of field names to mask
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} A promise that resolves to an array of field names to mask when logging
 */
// eslint-disable-next-line no-unused-vars
async function getFieldsToMask(existingFieldsToMask, pluginRegistry) {
  // This is where you can
  // 1. add your additional fields to mask here
  //
  //        const fieldsToMask = [
  //            ...existingFieldsToMask,
  //
  //            // add other fields to mask
  //            'someField1',
  //            'someField2'
  //          ]
  //        return fieldsToMask;
  //
  // 3. remove any existing field(s) from masking by returning an array without that field(s).
  //    This field will be removed from masking list (i.e., it will be logged as is)
  //
  //      return _.filter(fieldsToMask,_.negate(fieldName => fieldName === fieldNameToNotMask));
  //

  // TODO: Register additional fieldsToMask as per your solution requirements here
  const fieldsToMask = [...existingFieldsToMask];
  // DO NOT forget to return fieldsToMask here. If you do not return here no fields will be masked
  return fieldsToMask;
}

/**
 * Function to register solution specific implementation for settings service. This is an optional function.
 * By default, an implementation of settings service (i.e., "@aws-ee/base-services/lib/settings/env-settings-service")
 * that resolves settings from environment variables is already registered in the "container"
 *
 * @param container Services container
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerSettingsService(container, pluginRegistry) {
  // The container has default settings service already registered
  // If you want to register your own settings service implementation then
  // register it with the key "settings" as follows
  //
  // container.register('settings', yourSettingsServiceImpl);
}

/**
 * Function to register solution specific implementation for logger service. This is an optional function.
 * By default, an implementation of logger service (i.e., "@aws-ee/base-services/lib/logger/logger-service") is
 * already registered in the "container"
 *
 * @param container Services container
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerLoggerService(container, pluginRegistry) {
  // The container has default logger service already registered
  // If you want to register your own logger service implementation then
  // register it with the key "log" as follows
  //
  // container.register('log', yourLoggerServiceImpl);
}

const plugin = {
  registerServices,
  getStaticSettings,
  getLoggingContext,
  getFieldsToMaskInLog: getFieldsToMask,
  registerSettingsService,
  registerLoggerService,
};

module.exports = plugin;
