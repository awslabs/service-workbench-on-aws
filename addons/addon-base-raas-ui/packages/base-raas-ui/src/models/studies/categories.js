import _ from 'lodash';

const categories = {
  myStudies: { name: 'My Studies', id: 'my-studies' },
  organization: { name: 'Organization', id: 'organization' },
  openData: { name: 'Open Data', id: 'open-data' },
};

function getCategoryById(id) {
  return _.find(categories, ['id', id]);
}

export { categories, getCategoryById }; // eslint-disable-line import/prefer-default-export
