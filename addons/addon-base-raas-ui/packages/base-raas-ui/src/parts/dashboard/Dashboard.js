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
import _ from 'lodash';
import { decorate } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Container, Header, Segment, Icon } from 'semantic-ui-react';
import { displayError, displayWarning } from '@aws-ee/base-ui/dist/helpers/notification';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import { getEnvironments, getEnvironmentCost, getScEnvironments, getScEnvironmentCost } from '../../helpers/api';
import { enableBuiltInWorkspaces } from '../../helpers/settings';

import { blueDatasets } from './graphs/graph-options';
import BarGraph from './graphs/BarGraph';

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      totalCost: 0,
      indexNameToTotalCost: {},
      indexNameToUserTotalCost: {},
      envIdToCostInfo: {},
      envIdToEnvMetadata: {},
      duplicateEnvNames: new Set(),
      isLoading: true,
    };
  }

  async componentDidMount() {
    window.scrollTo(0, 0);
    try {
      const environmentFn = enableBuiltInWorkspaces ? getEnvironments : getScEnvironments;
      const getEnvironmentCostFn = enableBuiltInWorkspaces ? getEnvironmentCost : getScEnvironmentCost;
      const {
        totalCost,
        indexNameToTotalCost,
        indexNameToUserTotalCost,
        envIdToCostInfo,
        envIdToEnvMetadata,
        duplicateEnvNames,
      } = await getCosts(environmentFn, getEnvironmentCostFn);
      this.setState({
        totalCost,
        indexNameToTotalCost,
        indexNameToUserTotalCost,
        envIdToCostInfo,
        envIdToEnvMetadata,
        duplicateEnvNames,
        isLoading: false,
      });
    } catch (error) {
      const store = this.getStore();

      // "AccessDeniedException" error code is thrown when Cost Explorer hasn't been configured
      if (error.code === 'AccessDeniedException') {
        if (store.user.isAdmin) {
          // Cost Explorer related errors are only to be shown to admins, not researchers (GALI-266)
          displayWarning(
            'Error encountered accessing cost data. Please enable Cost Explorer in the AWS Management Console and wait for 24 hours.',
          );
        }
      } else {
        displayError(error.message);
      }
    }
  }

  getStore() {
    return this.props.userStore;
  }

  render() {
    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {this.renderContent()}
      </Container>
    );
  }

  renderTitle() {
    return (
      <div data-testid="page-title" className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="dashboard" className="align-top" />
          <Header.Content className="left-align">Dashboard</Header.Content>
        </Header>
      </div>
    );
  }

  renderContent() {
    return (
      <div>
        {this.state.isLoading === false && this.state.totalCost === 0 ? (
          <Segment className="bold">No cost data to show</Segment>
        ) : (
          <>
            <Segment>{this.renderCostPerIndex()}</Segment>
            <Segment>{this.renderPastMonthCostPerEnv()}</Segment>
            <Segment>{this.renderYesterdayCostPerEnv()}</Segment>
            <Segment className="clearfix">{this.renderPastMonthCostPerIndexPerUser()}</Segment>
            <Segment className="bold">
              Total cost of all research workspaces for the past 30 days: $
              {Math.round(this.state.totalCost * 100) / 100}
            </Segment>
          </>
        )}
      </div>
    );
  }

  renderCostPerIndex() {
    if (_.isEmpty(this.state.indexNameToTotalCost)) {
      return <ProgressPlaceHolder />;
    }
    const title = 'Index Costs for Past 30 Days';
    const labels = Object.keys(this.state.indexNameToTotalCost);
    const dataPoints = Object.keys(this.state.indexNameToTotalCost).map(indexName => {
      return this.state.indexNameToTotalCost[indexName];
    });
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderPastMonthCostPerEnv() {
    if (_.isEmpty(this.state.envIdToCostInfo)) {
      return <ProgressPlaceHolder />;
    }

    const pastMonthCostTotalArray = [];
    Object.keys(this.state.envIdToCostInfo).forEach(envId => {
      const total = _.sum(_.values(this.state.envIdToCostInfo[envId].pastMonthCostByUser));
      pastMonthCostTotalArray.push(total);
    });
    const title = 'Env Cost for Past 30 Days';
    const labels = getLabels(this.state.envIdToCostInfo, this.state.envIdToEnvMetadata, this.state.duplicateEnvNames);
    const dataPoints = pastMonthCostTotalArray;
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderYesterdayCostPerEnv() {
    if (_.isEmpty(this.state.envIdToCostInfo)) {
      return <ProgressPlaceHolder />;
    }
    const title = "Yesterday's Env Cost";
    const labels = getLabels(this.state.envIdToCostInfo, this.state.envIdToEnvMetadata, this.state.duplicateEnvNames);
    const dataPoints = Object.keys(this.state.envIdToCostInfo).map(envId => {
      return this.state.envIdToCostInfo[envId].yesterdayCost;
    });
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderPastMonthCostPerIndexPerUser() {
    if (_.isEmpty(this.state.indexNameToUserTotalCost)) {
      return <ProgressPlaceHolder />;
    }
    const results = [];
    Object.keys(this.state.indexNameToUserTotalCost).forEach(indexName => {
      const indexCostData = this.state.indexNameToUserTotalCost[indexName];
      const labels = Object.keys(indexCostData);
      // NOTE: We need a color for each user
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#CDDC39', '#4527a0', '#f4511e'];
      const datasets = [
        {
          data: Object.keys(indexCostData).map(user => {
            return indexCostData[user];
          }),
          backgroundColor: colors,
          hoverBackgroundColor: colors,
        },
      ];

      const data = {
        labels,
        datasets,
      };

      results.push(
        <div key={indexName} className="col col-6">
          <div className="center">{indexName}</div>
          <Pie data={data} />
        </div>,
      );
    });
    return (
      <>
        <div className="center bold">Index Cost Breakdowns for Past 30 Days</div>
        {results}
      </>
    );
  }
}

async function getCosts(getEnvironmentsFn, getEnvironmentCostFn) {
  const { envIdToCostInfo, envIdToEnvMetadata, duplicateEnvNames } = await getAccumulatedEnvCost(
    getEnvironmentsFn,
    getEnvironmentCostFn,
  );

  const indexNameToUserTotalCost = {};
  Object.keys(envIdToCostInfo).forEach(envId => {
    const indexName = envIdToEnvMetadata[envId].index;
    if (indexNameToUserTotalCost[indexName] === undefined) {
      indexNameToUserTotalCost[indexName] = {};
    }
    Object.keys(envIdToCostInfo[envId].pastMonthCostByUser).forEach(user => {
      const currentUserCost = _.get(indexNameToUserTotalCost[indexName], user, 0);
      indexNameToUserTotalCost[indexName][user] = currentUserCost + envIdToCostInfo[envId].pastMonthCostByUser[user];
    });
  });

  const indexNameToTotalCost = {};
  let totalCost = 0;
  Object.keys(indexNameToUserTotalCost).forEach(indexName => {
    let indexCost = 0;
    Object.keys(indexNameToUserTotalCost[indexName]).forEach(user => {
      indexCost += indexNameToUserTotalCost[indexName][user];
    });
    totalCost += indexCost;
    indexNameToTotalCost[indexName] = indexCost;
  });

  return {
    totalCost,
    indexNameToTotalCost,
    indexNameToUserTotalCost,
    envIdToCostInfo,
    envIdToEnvMetadata,
    duplicateEnvNames,
  };
}

function getLabels(envIdToCostInfo, envIdToEnvMetadata, duplicateEnvNames) {
  const labels = Object.keys(envIdToCostInfo).map(envId => {
    const envName = envIdToEnvMetadata[envId].name;
    if (duplicateEnvNames.has(envName)) {
      return `${envName}: ${envId}`;
    }
    return envName;
  });
  return labels;
}

async function getAccumulatedEnvCost(getEnvironmentsFn, getEnvironmentCostFn) {
  const environments = await getEnvironmentsFn();
  const duplicateEnvNames = new Set();
  const envNameToEnvId = {};
  const envIdToEnvMetadata = {};
  environments.forEach(env => {
    if (env.isExternal) return;
    envIdToEnvMetadata[env.id] = {
      index: env.indexId,
      name: env.name,
    };
    if (envNameToEnvId[env.name] === undefined) {
      envNameToEnvId[env.name] = env.id;
    } else {
      duplicateEnvNames.add(env.name);
    }
  });

  const envIds = Object.keys(envIdToEnvMetadata);
  const envCostPromises = envIds.map(envId => {
    return getEnvironmentCostFn(envId, 30, false, true);
  });

  const envCostResults = await Promise.all(envCostPromises);
  const pastMonthCostByUserArray = envCostResults.map(costResult => {
    const createdByToCost = {};
    _.forEach(costResult, costDate => {
      const cost = costDate.cost;
      Object.keys(cost).forEach(group => {
        let createdBy = group.split('$')[1];
        createdBy = createdBy || 'None';
        const currentUserCost = _.get(createdByToCost, createdBy, 0);
        createdByToCost[createdBy] = currentUserCost + cost[group].amount;
      });
    });
    return createdByToCost;
  });

  const yesterdayCostArray = envCostResults.map(costResult => {
    const yesterdayCost = costResult.length > 0 ? costResult[costResult.length - 1] : {};
    let totalCost = 0;
    if (yesterdayCost) {
      const arrayOfCosts = _.flatMapDeep(yesterdayCost.cost);
      arrayOfCosts.forEach(cost => {
        totalCost += cost.amount;
      });
    }
    return totalCost;
  });

  const envIdToCostInfo = {};
  for (let i = 0; i < envIds.length; i++) {
    envIdToCostInfo[envIds[i]] = {
      pastMonthCostByUser: pastMonthCostByUserArray[i],
      yesterdayCost: yesterdayCostArray[i],
    };
  }

  return { envIdToCostInfo, envIdToEnvMetadata, duplicateEnvNames };
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Dashboard, {});

export default inject('userStore')(withRouter(observer(Dashboard)));
export { getAccumulatedEnvCost, getCosts, getLabels };
