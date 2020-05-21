import { types } from 'mobx-state-tree';
// import { createSession } from '../../helpers/api';

const File = types.model('File', {
  name: '', // the extension of the file determines its type such as cram or crai
  size: types.optional(types.number, 0),
});

const Run = types.model('Run', {
  id: '',
  sample: '',
  alignment: '',
  sex: '',
  center: '',
  release: '',
  files: types.optional(types.array(File), []),
});

const Consent = types.model('Consent', {
  id: '', // such as 'phs00001.v1.p1.c1
  name: '', // 'code --- qualifier'
  runs: types.optional(types.array(Run), []),
});

const Token = types.model('Token', {
  id: '',
  expireAt: '',
  sessionId: '',
  username: '',
});

const Study = types.model('Study', {
  id: '',
  name: '',
  consents: types.optional(types.array(Consent), []),
});

const Session = types.model('Session', {
  id: types.identifier,
  title: '',
  studies: types.optional(types.array(Study), []),
  tokens: types.optional(types.array(Token), []),
});

// eslint-disable-next-line no-unused-vars
function createNewSession(raw) {
  return (
    Promise.resolve()
      // .then(() => createSession(raw))
      .then(result => Session.create(result))
  );
}

export { Session, createNewSession };
