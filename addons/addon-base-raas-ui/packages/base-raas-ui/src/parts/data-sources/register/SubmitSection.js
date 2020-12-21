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

import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';

// expected props
// - submitPhase (via prop)
class SubmitSection extends React.Component {
  get submitPhase() {
    return this.props.submitPhase;
  }

  get wizard() {
    return this.submitPhase.wizard;
  }

  render() {
    return <div>{this.submitPhase.name}</div>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(SubmitSection, {
  submitPhase: computed,
  wizard: computed,
});

export default inject()(withRouter(observer(SubmitSection)));
