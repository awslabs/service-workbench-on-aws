import React from 'react';

import { enableBuiltInWorkspaces } from '../../helpers/settings';
import BuiltIntEnvironmentDetailPage from '../environments-builtin/EnvironmentDetailPage';
import ScEnvironmentDetailPage from '../environments-sc/ScEnvironmentDetailPage';

export default () => (enableBuiltInWorkspaces ? <BuiltIntEnvironmentDetailPage /> : <ScEnvironmentDetailPage />);
