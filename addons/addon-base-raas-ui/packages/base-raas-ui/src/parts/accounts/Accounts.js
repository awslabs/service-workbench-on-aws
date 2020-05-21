import React from 'react';
import { Tab, Segment, Container } from 'semantic-ui-react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import AwsAccountsList from './AwsAccountsList';
import IndexesList from './IndexesList';
import ProjectsList from '../projects/ProjectsList';

const panes = [
  { menuItem: 'Projects', render: () => <ProjectsList /> },
  { menuItem: 'Indexes', render: () => <IndexesList /> },
  { menuItem: 'AWS Accounts', render: () => <AwsAccountsList /> },
];

// eslint-disable-next-line react/prefer-stateless-function
class Accounts extends React.Component {
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

export default inject('userRolesStore', 'indexesStore', 'awsAccountsStore')(withRouter(observer(Accounts)));
