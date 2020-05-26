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
import { withRouter } from 'react-router-dom';
import { observer } from 'mobx-react';
// Import React Table
import ReactTable from 'react-table';

// eslint-disable-next-line react/prefer-stateless-function
class UserTable extends React.Component {
  render() {
    const { userData } = this.props;
    return (
      <div>
        <ReactTable
          data={userData}
          columns={[
            {
              Header: 'Email',
              accessor: 'email',
            },
            {
              Header: 'User Role',
              accessor: 'userRole',
            },
            {
              Header: 'Identity Provider',
              accessor: 'identityProviderName',
            },
          ]}
          defaultPageSize={5}
          className="-striped -highlight"
        />
        <br />
      </div>
    );
  }
}

export default withRouter(observer(UserTable));
