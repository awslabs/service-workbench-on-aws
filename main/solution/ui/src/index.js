/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

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
