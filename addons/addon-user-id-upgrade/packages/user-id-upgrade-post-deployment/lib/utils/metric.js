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

class Metric {
  constructor(title) {
    this.title = title;
    this.startTime = undefined;
    this.endTime = undefined;
    this.stopped = false;
  }

  start() {
    if (this.stopped) return;
    this.startTime = process.hrtime();
  }

  end() {
    if (this.stopped) return;
    this.endTime = process.hrtime(this.startTime);
    this.stopped = true;
  }
}

module.exports = Metric;
