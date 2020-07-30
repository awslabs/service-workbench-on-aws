import React from 'react';

import { enableServiceCatalog } from '../../helpers/settings';
import BuiltIntEnvironmentDetailPage from '../environments-builtin/EnvironmentDetailPage';
import ScEnvironmentDetailPage from '../environments-sc/ScEnvironmentDetailPage';

export default () => (enableServiceCatalog ? <BuiltIntEnvironmentDetailPage /> : <ScEnvironmentDetailPage />);
