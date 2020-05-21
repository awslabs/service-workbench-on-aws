import React from 'react';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container } from 'semantic-ui-react';

import WorkflowPublishedTemplatesList from './published/WorkflowPublishedTemplatesList';
import WorkflowTemplateDraftsList from './drafts/WorkflowTemplateDraftsList';

// expected props
// - location (from react router)
class WorkflowTemplatesList extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  render() {
    return (
      <Container className="mt3">
        <WorkflowPublishedTemplatesList />
        <WorkflowTemplateDraftsList />
      </Container>
    );
  }
}

export default inject()(withRouter(observer(WorkflowTemplatesList)));
