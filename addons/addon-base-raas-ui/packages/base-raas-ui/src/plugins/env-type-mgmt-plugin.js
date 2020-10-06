import React from 'react';
import EnvTypeCardMetaActions from '../parts/environment-type-mgmt/EnvTypeCardMetaActions';

function getEnvTypeCardMetaActions(payloadSoFar, envType) {
  return [...(payloadSoFar || []), <EnvTypeCardMetaActions key={envType.id} envType={envType} />];
}

const plugin = {
  getEnvTypeCardMetaActions,
};

export default plugin;
