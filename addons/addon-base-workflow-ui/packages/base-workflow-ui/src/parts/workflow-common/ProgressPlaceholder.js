import _ from 'lodash';
import React from 'react';
import { Segment, Placeholder, Divider } from 'semantic-ui-react';

// expected props
// - segmentCount (via props)
// - className (via props)
const Component = ({ segmentCount = 1 }) => {
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
        <Placeholder.Line length="full" />
        <Placeholder.Line length="full" />
        <Placeholder.Line length="full" />
      </Placeholder>
    </Segment>
  );

  return _.map(_.times(segmentCount, String), index => segment(index));
};

export default Component;
