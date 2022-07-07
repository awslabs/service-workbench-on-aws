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

const prefix = require('./log-prefix');
const Metric = require('./metric');

function toMilliseconds(hrtime) {
  return (hrtime[0] * 1000000000 + hrtime[1]) / 1000000;
}

class Metrics {
  constructor(saveFn, log) {
    this.saveFn = saveFn;
    this.log = log;
    this.metrics = [];
  }

  start() {
    this.metrics = [];
    this.mainMetric = new Metric('Upgrade user id post deployment step');
    this.mainMetric.start();
  }

  end() {
    this.mainMetric.end();
  }

  addMetric(metric) {
    const { title, endTime = [0, 0] } = metric;
    this.metrics.push({ title, ms: toMilliseconds(endTime) });
  }

  toMilliseconds() {
    return toMilliseconds(this.mainMetric.endTime);
  }

  async save() {
    try {
      this.end();
      const value = {
        ms: this.toMilliseconds(),
        metrics: this.metrics,
      };
      const time = new Date().toISOString();
      await this.saveFn({ id: `metrics-${time}`, value: JSON.stringify(value) });
      this.log.info({ msg: prefix('Metrics'), metrics: value });
    } catch (error) {
      // We don't want to propagate this error
      this.log.info(prefix(`Note: encountered an error while trying to save user id upgrade metrics. ${error}`));
    }
  }
}

module.exports = Metrics;
