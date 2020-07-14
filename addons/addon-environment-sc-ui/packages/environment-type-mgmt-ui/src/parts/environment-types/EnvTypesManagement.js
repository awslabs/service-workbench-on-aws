import React from 'react';
import { observer } from 'mobx-react';
import { Container, Divider } from 'semantic-ui-react';

import EnvTypeCandidatesList from './EnvTypeCandidatesList';
import EnvTypesList from './EnvTypesList';

function EnvTypesManagement() {
  return (
    <Container className="mt3">
      <EnvTypeCandidatesList />
      <Divider />
      <EnvTypesList />
    </Container>
  );
}

export default observer(EnvTypesManagement);
