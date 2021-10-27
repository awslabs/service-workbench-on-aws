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
import { observer } from 'mobx-react';
import c from 'classnames';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Popup, Icon } from 'semantic-ui-react';
import { displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

// expected props
// - text (via props)
// - message (via props) (a message to display when done copying to clip board "optional")
// - size (via props) (the size of the copy icon)
// - icon (via props) (the name of the icon, default to 'copy outline')
// - className (via props)
const Component = observer(
  ({ text = '', className = 'ml2 mt1', message = 'Copied to clipboard', size, name = 'copy outline' }) => {
    const iconAttrs = { name };
    if (size) iconAttrs.size = size;

    return (
      <Popup
        content="Copy"
        trigger={
          <CopyToClipboard
            data-testid="copy-to-clipboard-button"
            className={c(className)}
            text={text}
            style={{ cursor: 'pointer' }}
            onCopy={() => displaySuccess(message, 'Done')}
          >
            <Icon {...iconAttrs} />
          </CopyToClipboard>
        }
      />
    );
  },
);

export default Component;
