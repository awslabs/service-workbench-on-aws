import { createForm } from '../../helpers/form';
import { categories } from '../studies/categories';

const createStudyFields = {
  // General fields
  id: {
    label: 'ID',
    placeholder: 'A unique ID used to reference the study',
    extra: {
      explain: 'Must be less than 100 characters long and only contain alphanumeric characters, "-", or "_"',
    },
    rules: ['required', 'string', 'between:1,100', 'regex:/^[A-Za-z0-9-_]+$/'],
  },
  categoryId: {
    label: '', // not shown because extra.showHeader = false
    extra: {
      explain:
        'If you choose "My Study", only you can access it. If you choose "Organization Study", you get to decide who can access it.',
      yesLabel: 'My Study',
      noLabel: 'Organization Study',
      yesValue: categories.myStudies.id,
      noValue: categories.organization.id,
      showHeader: false,
    },
    rules: ['required'],
  },
  name: {
    label: 'Name',
    placeholder: 'A name for the study',
    rules: ['string', 'max:2048'],
  },
  description: {
    label: 'Description',
    placeholder: 'A description of the study',
    rules: ['string', 'max:8192'],
  },
  projectId: {
    label: 'Project ID',
    placeholder: 'The project ID associated with this study',
    rules: ['required', 'string', 'min:1', 'max:100'],
  },
};

const getCreateStudyForm = () => {
  return createForm(createStudyFields);
};

export { getCreateStudyForm }; // eslint-disable-line import/prefer-default-export
