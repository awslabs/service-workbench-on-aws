// eslint-disable-next-line no-unused-vars
import { httpApiGet, httpApiPost, httpApiPut, httpApiDelete } from '@aws-ee/base-ui/dist/helpers/api';

function getKeyPairs() {
  return httpApiGet('api/key-pairs/');
}

function createKeyPair(keyPair) {
  return httpApiPost('api/key-pairs/', { data: keyPair });
}

function deleteKeyPair(id) {
  return httpApiDelete(`api/key-pairs/${id}`);
}

export { createKeyPair, getKeyPairs, deleteKeyPair };
