import React from 'react';
import { decorate, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { Modal, Form, Header, Button } from 'semantic-ui-react';
import PropTypes from 'prop-types';

class UserPinModal extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.errorMsg = undefined;
    });
  }

  handlePinSubmission = async e => {
    e.preventDefault();
    e.persist();

    // Will throw error if PIN is incorrect
    try {
      await this.props.user.unencryptedCreds(e.target.pin.value);
      runInAction(() => {
        this.errorMsg = undefined;
      });
      this.props.hideModal();
    } catch (error) {
      runInAction(() => {
        this.errorMsg = error.message;
      });
    }
  };

  render() {
    return (
      <Modal
        as={Form}
        onSubmit={this.handlePinSubmission}
        open={this.props.show}
        size="tiny"
        onClose={this.props.hideModal}
        closeOnDimmerClick
      >
        <Header content="Enter PIN" />
        <Modal.Content>
          {this.props.message}
          <Form.Input
            label="PIN"
            name="pin"
            required
            type="password"
            placeholder="Your pin to access your AWS IAM user"
            error={this.errorMsg}
          />
        </Modal.Content>
        <Modal.Actions>
          <Button type="button" content="Close" onClick={this.props.hideModal} />
          <Button type="submit" color="blue" content="Save" />
        </Modal.Actions>
      </Modal>
    );
  }
}
UserPinModal.propTypes = {
  show: PropTypes.bool.isRequired,
  hideModal: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  user: PropTypes.object.isRequired,
  message: PropTypes.string,
};
UserPinModal.defaultProps = {
  message: '',
};

decorate(UserPinModal, {
  errorMsg: observable,
});

export default observer(UserPinModal);
