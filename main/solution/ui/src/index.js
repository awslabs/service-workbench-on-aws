import { renderAppContainer, renderError, renderProgress } from '@aws-ee/base-ui/dist/render-utils';
import bootstrapApp from '@aws-ee/base-ui/dist/bootstrap-app';
import pluginRegistry from './plugins/plugin-registry';

import 'typeface-lato';
import './css/basscss-important.css';
import './css/semantic.min.css';
import './css/animate.css';
import 'toastr/build/toastr.css';
import 'react-table/react-table.css';
import './css/index.css';

bootstrapApp({
  renderAppContainer,
  renderError,
  renderProgress,
  pluginRegistry,
});
