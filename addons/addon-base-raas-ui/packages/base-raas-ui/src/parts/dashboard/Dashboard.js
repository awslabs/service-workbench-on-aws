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
import { observer } from 'mobx-react';
import { Pie } from 'react-chartjs-2';
import { Container, Header, Segment, Icon } from 'semantic-ui-react';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
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
      projNameToTotalCost: {},
      projNameToUserTotalCost: {},
      envNameToCostInfo: {},
      isLoading: true,
    };
  }

  async componentDidMount() {
    window.scrollTo(0, 0);
    try {
      const { totalCost, projNameToTotalCost, projNameToUserTotalCost, envNameToCostInfo } = await this.getCosts();
      this.setState({
        totalCost,
        projNameToTotalCost,
        projNameToUserTotalCost,
        envNameToCostInfo,
        isLoading: false,
      });
    } catch (error) {
      displayError('Error encountered retrieving cost data. Please refresh the page or try again later.');
    }
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
      <div className="mb3 flex">
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
            <Segment>{this.renderCostPerProj()}</Segment>
            <Segment>{this.renderPastMonthCostPerEnv()}</Segment>
            <Segment>{this.renderYesterdayCostPerEnv()}</Segment>
            <Segment className="clearfix">{this.renderPastMonthCostPerProjPerUser()}</Segment>
            <Segment className="bold">
              Total cost of all research workspaces for the past 30 days: $
              {Math.round(this.state.totalCost * 100) / 100}
            </Segment>
          </>
        )}
      </div>
    );
  }

  async getCosts() {
    const { envNameToCostInfo, envNameToIndex } = await this.getAccumulatedEnvCost();

    const projNameToUserTotalCost = {};
    Object.keys(envNameToCostInfo).forEach(envName => {
      const projName = envNameToIndex[envName];
      if (projNameToUserTotalCost[projName] === undefined) {
        projNameToUserTotalCost[projName] = {};
      }
      Object.keys(envNameToCostInfo[envName].pastMonthCostByUser).forEach(user => {
        const currentUserCost = _.get(projNameToUserTotalCost, `${projName}.${user}`, 0);
        projNameToUserTotalCost[projName][user] =
          currentUserCost + envNameToCostInfo[envName].pastMonthCostByUser[user];
      });
    });

    const projNameToTotalCost = {};
    let totalCost = 0;
    Object.keys(projNameToUserTotalCost).forEach(projName => {
      let indexCost = 0;
      Object.keys(projNameToUserTotalCost[projName]).forEach(user => {
        indexCost += projNameToUserTotalCost[projName][user];
      });
      totalCost += indexCost;
      projNameToTotalCost[projName] = indexCost;
    });

    return { totalCost, projNameToTotalCost, projNameToUserTotalCost, envNameToCostInfo };
  }

  async getAccumulatedEnvCost() {
    const environments = enableBuiltInWorkspaces ? await getEnvironments() : await getScEnvironments();
    const envIdToName = {};

    const envNameToIndex = {};
    environments.forEach(env => {
      if (env.isExternal) return;
      envIdToName[env.id] = env.name;
      envNameToIndex[env.name] = env.indexId;
    });

    const envIds = Object.keys(envIdToName);
    const envCostPromises = envIds.map(envId => {
      return enableBuiltInWorkspaces
        ? getEnvironmentCost(envId, 30, false, true)
        : getScEnvironmentCost(envId, 30, false, true);
    });

    const envCostResults = await Promise.all(envCostPromises);
    const pastMonthCostByUserArray = envCostResults.map(costResult => {
      const createdByToCost = {};
      costResult.forEach(costDate => {
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
      const yesterdayCost = costResult[costResult.length - 1];
      let totalCost = 0;
      const arrayOfCosts = _.flatMapDeep(yesterdayCost.cost);
      arrayOfCosts.forEach(cost => {
        totalCost += cost.amount;
      });
      return totalCost;
    });

    const envNameToCostInfo = {};
    for (let i = 0; i < envIds.length; i++) {
      const key = envIdToName[envIds[i]];
      envNameToCostInfo[key] = {
        pastMonthCostByUser: pastMonthCostByUserArray[i],
        yesterdayCost: yesterdayCostArray[i],
      };
    }
    return { envNameToCostInfo, envNameToIndex };
  }

  renderCostPerProj() {
    if (_.isEmpty(this.state.projNameToTotalCost)) {
      return <ProgressPlaceHolder />;
    }
    const title = 'Index Costs for Past 30 Days';
    const labels = Object.keys(this.state.projNameToTotalCost);
    const dataPoints = Object.keys(this.state.projNameToTotalCost).map(projName => {
      return this.state.projNameToTotalCost[projName];
    });
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderPastMonthCostPerEnv() {
    if (_.isEmpty(this.state.envNameToCostInfo)) {
      return <ProgressPlaceHolder />;
    }

    const pastMonthCostTotalArray = [];
    Object.keys(this.state.envNameToCostInfo).forEach(envName => {
      let total = 0;
      Object.keys(this.state.envNameToCostInfo[envName].pastMonthCostByUser).forEach(user => {
        total += this.state.envNameToCostInfo[envName].pastMonthCostByUser[user];
      });
      pastMonthCostTotalArray.push(total);
    });
    const title = 'Env Cost for Past 30 Days';
    const labels = Object.keys(this.state.envNameToCostInfo);
    const dataPoints = pastMonthCostTotalArray;
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderYesterdayCostPerEnv() {
    if (_.isEmpty(this.state.envNameToCostInfo)) {
      return <ProgressPlaceHolder />;
    }
    const title = "Yesterday's Env Cost";
    const labels = Object.keys(this.state.envNameToCostInfo);
    const dataPoints = Object.keys(this.state.envNameToCostInfo).map(envName => {
      return this.state.envNameToCostInfo[envName].yesterdayCost;
    });
    const data = {
      labels,
      datasets: blueDatasets(title, dataPoints),
    };

    return <BarGraph className="mr4" data={data} title={title} />;
  }

  renderPastMonthCostPerProjPerUser() {
    if (_.isEmpty(this.state.projNameToUserTotalCost)) {
      return <ProgressPlaceHolder />;
    }
    const results = [];
    Object.keys(this.state.projNameToUserTotalCost).forEach(projName => {
      const projCostData = this.state.projNameToUserTotalCost[projName];
      const labels = Object.keys(projCostData);
      // NOTE: We need a color for each user
      const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#CDDC39', '#4527a0', '#f4511e'];
      const datasets = [
        {
          data: Object.keys(projCostData).map(user => {
            return projCostData[user];
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
        <div key={projName} className="col col-6">
          <div className="center">{projName}</div>
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

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Dashboard, {});

export default observer(Dashboard);
