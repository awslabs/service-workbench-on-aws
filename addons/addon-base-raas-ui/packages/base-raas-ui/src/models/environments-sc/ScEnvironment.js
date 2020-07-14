/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { types, applySnapshot } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

// 'COMPLETED', 'PENDING', 'TAINTED', 'FAILED', 'TERMINATING', 'TERMINATED', 'TERMINATING_FAILED', 'UNKNOWN'
// Note: 'UNKNOWN' is not something that is returned from the server, it is here to catch any other status
// that we don't know about.
const states = [
  {
    key: 'COMPLETED',
    display: 'AVAILABLE',
    color: 'green',
    tip: 'The workspace is ready to be used.',
    spinner: false,
    canTerminate: true,
    canConnect: true,
  },
  {
    key: 'PENDING',
    display: 'PENDING',
    color: 'orange',
    tip: 'The workspace is being prepared, this could take sometime.',
    spinner: true,
    canTerminate: false,
    canConnect: false,
  },
  {
    key: 'TAINTED',
    display: 'TAINTED',
    color: 'orange',
    tip: 'The workspace is ready but the latest configuration updates might not have been successful.',
    spinner: false,
    canTerminate: true,
    canConnect: true,
  },
  {
    key: 'FAILED',
    display: 'FAILED',
    color: 'red',
    tip: 'Something went wrong.',
    spinner: false,
    canTerminate: true,
    canConnect: false,
  },
  {
    key: 'TERMINATING',
    display: 'TERMINATING',
    color: 'red',
    tip: 'The workspace is being terminated. This could take sometime.',
    spinner: true,
    canTerminate: false,
    canConnect: false,
  },
  {
    key: 'TERMINATED',
    display: 'TERMINATED',
    color: 'grey',
    tip: 'The workspace is terminated successfully and no longer available.',
    spinner: false,
    canTerminate: false,
    canConnect: false,
  },
  {
    key: 'TERMINATING_FAILED',
    display: 'TERMINATION FAILED',
    color: 'red',
    tip:
      'The workspace was not terminated correctly, it is possible that some compute and storage resources are still in place.',
    spinner: false,
    canTerminate: true,
    canConnect: true,
  },
  {
    key: 'UNKNOWN',
    display: 'UNKNOWN',
    color: 'grey',
    tip: 'Something not right. This requires further investigation by the administrator.',
    spinner: false,
    canTerminate: true,
    canConnect: true,
  },
];

// ==================================================================
// ScEnvironment
// ==================================================================
const ScEnvironment = types
  .model('ScEnvironment', {
    id: types.identifier,
    rev: types.maybe(types.number),
    status: '',
    description: '',
    name: '',
    projectId: '',
    envTypeId: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    error: types.maybeNull(types.string),
    connections: types.frozen([]),
    studyIds: types.frozen([]),
    cidr: '',
    outputs: types.frozen([]),
  })
  .actions(self => ({
    setScEnvironment(rawEnvironment) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic

      applySnapshot(self, rawEnvironment);
    },
    setStatus(status) {
      self.status = status;
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // State is a generalization of the status name. With the state object, we can provide more
    // information about the state and what can be done/displayed
    get state() {
      // We need to clone the entry so that we don't impact the existing states object
      const entry = _.cloneDeep(_.find(states, ['key', self.status]) || _.find(states, ['key', 'UNKNOWN']));

      // The canConnect value is also determined by looking at the existing state requirement and
      // if the connections array is not empty
      entry.canConnect = entry.canConnect && !_.isEmpty(self.connections);

      return entry;
    },
  }));

export { ScEnvironment };
