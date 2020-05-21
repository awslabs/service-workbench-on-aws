import React from 'react';
import { Tab, Segment, Container } from 'semantic-ui-react';
import { observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import RolesList from './RolesList';
import UsersList from './UsersList';

const panes = [
  { menuItem: 'Users', render: () => <UsersList /> },
  { menuItem: 'Roles', render: () => <RolesList /> },
];

// eslint-disable-next-line react/prefer-stateless-function
class User extends React.Component {
  render() {
    return (
      <Container className="mt3 animated fadeIn">
        <Segment basic className="p0">
          <Tab panes={panes} />
        </Segment>
      </Container>
    );
  }
}

export default withRouter(observer(User));
