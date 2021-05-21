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
import { action, decorate, observable, runInAction } from 'mobx';
import { Button, Header, Modal } from 'semantic-ui-react';

class UpdateAccountPerms extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.modalOpen = false;
    });
  }

  render() {
    return (
      <Modal
        closeIcon
        trigger={this.renderTrigger()}
        open={this.modalOpen}
        onClose={action(() => {
          this.modalOpen = false;
        })}
      >
        <div className="mt2 animated fadeIn">
          <Header as="h3" icon textAlign="center" className="mt3" color="grey">
            Update Account Permissions
          </Header>
          <div className="mx3 animated fadeIn">
            <Header as="h3" icon textAlign="center" className="mt3" color="grey">
              Stuff will go here
            </Header>
          </div>
        </div>
      </Modal>
    );
  }

  renderTrigger() {
    return (
      <Button
        floated="right"
        color="blue"
        basic
        onClick={action(() => {
          this.modalOpen = true;
        })}
      >
        Check Account Permissions
      </Button>
    );
  }
}

decorate(UpdateAccountPerms, {
  modalOpen: observable,
});

export default observer(UpdateAccountPerms);
