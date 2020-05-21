import React from 'react';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container } from 'semantic-ui-react';

import WorkflowPublishedList from './published/WorkflowPublishedList';
import WorkflowDraftsList from './drafts/WorkflowDraftsList';

// expected props
// - location (from react router)
class WorkflowsList extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    return (
      <Container className="mt3">
        <WorkflowPublishedList />
        <WorkflowDraftsList />
      </Container>
    );
  }
}

export default inject()(withRouter(observer(WorkflowsList)));
