import React from 'react';
import { Accordion } from 'semantic-ui-react';
import { observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';

import faqJson from '../../../faq-questions.json';

// eslint-disable-next-line react/prefer-stateless-function
class FaqSection extends React.Component {
  render() {
    const optPanels = faqJson.categories.map(category => {
      const interiorPanels = category.questions.map(question => {
        const ret = {
          key: question.title,
          title: question.title,
          content: question.answer,
        };
        return ret;
      });

      return {
        key: category.title,
        title: category.title,
        content: {
          content: (
            <div>
              <Accordion.Accordion
                active="true"
                exclusive={false}
                defaultActiveIndex={[]}
                key={category.title}
                panels={interiorPanels}
              />
            </div>
          ),
        },
      };
    });
    return (
      <div className="mt3 mb3 animated fadeIn">
        {' '}
        <Accordion active="true" exclusive={false} defaultActiveIndex={[]} panels={optPanels} fluid styled />
      </div>
    );
  }
}

export default withRouter(observer(FaqSection));
