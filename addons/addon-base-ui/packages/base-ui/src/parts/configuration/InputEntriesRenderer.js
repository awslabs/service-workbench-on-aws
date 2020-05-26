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
import { decorate } from 'mobx';
import { observer, inject } from 'mobx-react';

import InputEntryRenderer from './InputEntryRenderer';

// expected props
// - form (via props)
// - inputEntries (via props) (these are the input manifest input entries)
// - processing (via props) (default to false)
class InputEntriesRenderer extends React.Component {
  getForm() {
    return this.props.form;
  }

  getInputEntries() {
    return this.props.inputEntries;
  }

  render() {
    const processing = this.props.processing || false;
    const form = this.getForm();
    // entry is an object of this shape:
    // { name: 'id',  type: 'string/yesNo,..', label, children: [ <optional> ], .. }
    const entries = this.getInputEntries();
    return (
      <>
        {_.map(entries, entry => (
          <InputEntryRenderer key={entry.name} form={form} inputEntry={entry} processing={processing} />
        ))}
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(InputEntriesRenderer, {});

export default inject()(observer(InputEntriesRenderer));
