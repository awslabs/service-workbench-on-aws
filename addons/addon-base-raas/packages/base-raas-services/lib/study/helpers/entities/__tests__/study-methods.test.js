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

const { hasAccess, accessLevels } = require('../study-methods');
const { getEmptyStudyPermissions } = require('../study-permissions-methods');

describe('study methods', () => {
  describe('hasAccess', () => {
    it('should return false if no permissions object is present and not an open data', () => {
      const studyEntity = {
        category: 'My Studies',
      };

      expect(hasAccess(studyEntity, 'u-1')).toBeFalsy();
    });

    it('should return true if no permissions object is present and it is an open data', () => {
      const studyEntity = {
        category: 'Open Data',
      };

      expect(hasAccess(studyEntity, 'u-1')).toBeTruthy();
    });

    it('should return true even if permissions object is present and it is an open data', () => {
      const studyEntity = {
        category: 'Open Data',
        permissions: getEmptyStudyPermissions(),
      };

      expect(hasAccess(studyEntity, 'u-1')).toBeTruthy();
    });

    it('should return false if user has no permissions', () => {
      const uid = 'u-1';
      const studyEntity = {
        category: 'My Studies',
        permissions: {
          adminUsers: [],
        },
      };

      expect(hasAccess(studyEntity, uid)).toBeFalsy();
    });

    it('should return if true if user has study admin access', () => {
      const uid = 'u-1';
      const studyEntity = {
        category: 'My Studies',
        permissions: {
          adminUsers: [uid],
        },
      };

      expect(hasAccess(studyEntity, uid)).toBeTruthy();
    });

    it('should return if true if user has study readonly access', () => {
      const uid = 'u-1';
      const studyEntity = {
        category: 'Organization',
        permissions: {
          readonlyUsers: [uid],
        },
      };

      expect(hasAccess(studyEntity, uid)).toBeTruthy();
    });

    it('should return if true if user has study readwrite access', () => {
      const uid = 'u-1';
      const studyEntity = {
        category: 'Organization',
        permissions: {
          readwriteUsers: [uid],
        },
      };

      expect(hasAccess(studyEntity, uid)).toBeTruthy();
    });

    it('should return if true if user has study writeonly access', () => {
      const uid = 'u-1';
      const studyEntity = {
        category: 'Organization',
        permissions: {
          writeonlyUsers: [uid],
        },
      };

      expect(hasAccess(studyEntity, uid)).toBeTruthy();
    });

    it('should account for accessType of readonly, readwrite and writeonly', () => {
      const uid = 'u-1';
      const getStudy = (accessType, level) => ({
        category: 'Organization',
        accessType,
        permissions: {
          [`${level}Users`]: [uid],
        },
      });

      expect(hasAccess(getStudy('readonly', 'readonly'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('readonly', 'readwrite'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('readonly', 'writeonly'), uid)).toBeFalsy();

      expect(hasAccess(getStudy('readwrite', 'readonly'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('readwrite', 'readwrite'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('readwrite', 'writeonly'), uid)).toBeTruthy();

      // accessType defaults to readwrite
      expect(hasAccess(getStudy('', 'readonly'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('', 'readwrite'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('', 'writeonly'), uid)).toBeTruthy();

      expect(hasAccess(getStudy('writeonly', 'readonly'), uid)).toBeFalsy();
      expect(hasAccess(getStudy('writeonly', 'readwrite'), uid)).toBeTruthy();
      expect(hasAccess(getStudy('writeonly', 'writeonly'), uid)).toBeTruthy();
    });
  });

  describe('accessLevels', () => {
    it('should account for accessType of readonly, readwrite and writeonly for org studies', () => {
      const uid = 'u-1';
      const getStudy = (accessType, level) => ({
        category: 'Organization',
        accessType,
        permissions: {
          [`${level}Users`]: [uid],
        },
      });

      const output = (admin = false, read = false, write = false) => ({ admin, read, write });

      expect(accessLevels(getStudy('readonly', 'admin'), uid)).toStrictEqual(output(true, true, false));
      expect(accessLevels(getStudy('readonly', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'writeonly'), uid)).toStrictEqual(output(false, false, false));

      expect(accessLevels(getStudy('readwrite', 'admin'), uid)).toStrictEqual(output(true, true, false));
      expect(accessLevels(getStudy('readwrite', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readwrite', 'readwrite'), uid)).toStrictEqual(output(false, true, true));
      expect(accessLevels(getStudy('readwrite', 'writeonly'), uid)).toStrictEqual(output(false, false, true));

      // accessType defaults to readwrite
      expect(accessLevels(getStudy('', 'admin'), uid)).toStrictEqual(output(true, true, false));
      expect(accessLevels(getStudy('', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('', 'readwrite'), uid)).toStrictEqual(output(false, true, true));
      expect(accessLevels(getStudy('', 'writeonly'), uid)).toStrictEqual(output(false, false, true));

      expect(accessLevels(getStudy('writeonly', 'admin'), uid)).toStrictEqual(output(true, false, true));
      expect(accessLevels(getStudy('writeonly', 'readonly'), uid)).toStrictEqual(output(false, false, false));
      expect(accessLevels(getStudy('writeonly', 'readwrite'), uid)).toStrictEqual(output(false, false, true));
      expect(accessLevels(getStudy('writeonly', 'writeonly'), uid)).toStrictEqual(output(false, false, true));
    });

    it('should account for accessType of readonly, readwrite and writeonly for my studies', () => {
      const uid = 'u-1';
      const getStudy = (accessType, level) => ({
        category: 'My Studies',
        accessType,
        permissions: {
          [`${level}Users`]: [uid],
        },
      });

      const output = (admin = false, read = false, write = false) => ({ admin, read, write });

      expect(accessLevels(getStudy('readonly', 'admin'), uid)).toStrictEqual(output(true, true, false));
      expect(accessLevels(getStudy('readonly', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'writeonly'), uid)).toStrictEqual(output(false, false, false));

      expect(accessLevels(getStudy('readwrite', 'admin'), uid)).toStrictEqual(output(true, true, true));
      expect(accessLevels(getStudy('readwrite', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readwrite', 'readwrite'), uid)).toStrictEqual(output(false, true, true));
      expect(accessLevels(getStudy('readwrite', 'writeonly'), uid)).toStrictEqual(output(false, false, true));

      // accessType defaults to readwrite
      expect(accessLevels(getStudy('', 'admin'), uid)).toStrictEqual(output(true, true, true));
      expect(accessLevels(getStudy('', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('', 'readwrite'), uid)).toStrictEqual(output(false, true, true));
      expect(accessLevels(getStudy('', 'writeonly'), uid)).toStrictEqual(output(false, false, true));

      expect(accessLevels(getStudy('writeonly', 'admin'), uid)).toStrictEqual(output(true, false, true));
      expect(accessLevels(getStudy('writeonly', 'readonly'), uid)).toStrictEqual(output(false, false, false));
      expect(accessLevels(getStudy('writeonly', 'readwrite'), uid)).toStrictEqual(output(false, false, true));
      expect(accessLevels(getStudy('writeonly', 'writeonly'), uid)).toStrictEqual(output(false, false, true));
    });

    it('should account for accessType of readonly, readwrite and writeonly for open data', () => {
      const uid = 'u-1';
      const getStudy = (accessType, level) => ({
        category: 'Open Data',
        accessType,
        permissions: {
          [`${level}Users`]: [uid],
        },
      });

      const output = (admin = false, read = false, write = false) => ({ admin, read, write });

      expect(accessLevels(getStudy('readonly', 'admin'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readonly', 'writeonly'), uid)).toStrictEqual(output(false, true, false));

      expect(accessLevels(getStudy('readwrite', 'admin'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readwrite', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readwrite', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('readwrite', 'writeonly'), uid)).toStrictEqual(output(false, true, false));

      // accessType defaults to readwrite
      expect(accessLevels(getStudy('', 'admin'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('', 'writeonly'), uid)).toStrictEqual(output(false, true, false));

      expect(accessLevels(getStudy('writeonly', 'admin'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('writeonly', 'readonly'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('writeonly', 'readwrite'), uid)).toStrictEqual(output(false, true, false));
      expect(accessLevels(getStudy('writeonly', 'writeonly'), uid)).toStrictEqual(output(false, true, false));
    });
  });
});
