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
