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
import { User } from '../User';

describe('User', () => {
  it('should get all user fields correctly', () => {
    const userJson = {
      uid: 'u-N__Z_pJTr5oSNUaM6-oP7',
      firstName: 'John',
      lastName: 'Smith',
      isAdmin: false,
      isExternalUser: false,
      username: 'JohnSmith@amazon.com',
      ns: 'internal',
      email: 'JohnSmith@amazon.com',
      authenticationProviderId: 'internal',
      status: 'active',
      createdBy: 'u-0Jse-jzwgiczKaa74IFKg',
      rev: 1,
      userRole: 'researcher',
      projectId: ['Project1'],
      encryptedCreds: 'N/A',
      applyReason: 'N/A',
    };

    const user = User.create(userJson);

    expect(user.displayName).toEqual('John Smith');
    expect(user.longDisplayName).toEqual('John Smith (JohnSmith@amazon.com)');
    expect(user.unknown).toEqual(false);
    expect(user.isRootUser).toEqual(false);
    expect(user.isInternalAuthUser).toEqual(true);
    expect(user.isActive).toEqual(true);
    expect(user.isInternalGuest).toEqual(false);
    expect(user.isExternalGuest).toEqual(false);
    expect(user.isInternalResearcher).toEqual(true);
    expect(user.isSystem).toEqual(false);
    expect(user.isSame('abcd')).toEqual(false);
    expect(user.isSamePrincipal('abcd', 'xyz')).toEqual(false);
    expect(user.id).toEqual('u-N__Z_pJTr5oSNUaM6-oP7');
    expect(user.principal).toEqual({ username: 'JohnSmith@amazon.com', ns: 'internal' });
    expect(user.principalStr).toEqual(JSON.stringify({ username: 'JohnSmith@amazon.com', ns: 'internal' }));
    expect(user.hasProjects).toEqual(true);
    expect(user.hasCredentials).toEqual(false);
    expect(user.capabilities).toEqual({
      canCreateStudy: true,
      canCreateWorkspace: true,
      canSelectStudy: true,
      canViewDashboard: true,
    });
  });
});
