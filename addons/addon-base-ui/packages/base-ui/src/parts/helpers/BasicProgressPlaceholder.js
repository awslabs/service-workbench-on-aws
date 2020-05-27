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

import _ from 'lodash';
import React from 'react';
import { Segment, Placeholder, Divider } from 'semantic-ui-react';

// expected props
// - segmentCount (via props)
// - className (via props)
const Component = ({ segmentCount = 1, className }) => {
  const segment = index => (
    <Segment key={index} className="p3 mb2">
      <Placeholder fluid>
        <Placeholder.Header>
          <Placeholder.Line length="full" />
        </Placeholder.Header>
        <Placeholder.Paragraph>
          <Placeholder.Line length="short" />
        </Placeholder.Paragraph>
      </Placeholder>
      <Divider className="mt3" />
      <Placeholder fluid>
        <Placeholder.Line length="full" />
      </Placeholder>
    </Segment>
  );

  return <div className={className}>{_.map(_.times(segmentCount, String), index => segment(index))}</div>;
};

export default Component;
