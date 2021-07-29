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

const { iteratee } = require('lodash');
const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const LaunchProduct = require('../launch-product/launch-product');

describe('LaunchProduct', ()=> {
      const meta = {};
      const input = {};
    
      const lp = new LaunchProduct({
        step: { config: {} },
        workflowPayload: new WorkflowPayload({ meta, input, workflowInstance: { steps: [] } }),
      });

    describe('checkNamespace', () => {
        it('Static name should be transformed to start with analysis- and end with number string and be unique between calls', async () => {
            // Build 
            const resolvedInputParams = [{Key: 'Namespace', Value: 'staticname'}];
            const datetime = Date.now();
    
            // Operate
            const after = await lp.checkNamespace(resolvedInputParams, datetime);
            const after2 = await lp.checkNamespace(resolvedInputParams, datetime);
    
            // Check
            await expect(after[0].Value.startsWith('analysis-')).toBeTruthy() && expect(Number(after[0].Value.split('-').pop())).not.toBe(NaN) && expect(after === after2).toBeFalsy();
        });
    
        it('Static name that begins with analysis- should be transformed to end with number string and be unique between calls', async () => {
            // Build
            const resolvedInputParams = [{Key: 'Namespace', Value: 'analysis-staticname'}];
            const datetime = Date.now();
    
            // Operate
            const after = await lp.checkNamespace(resolvedInputParams, datetime);
            const after2 = await lp.checkNamespace(resolvedInputParams, datetime);
    
            // Check
            await expect(Number(after[0].Value.split('-').pop())).not.toBe(NaN) && expect(after === after2).toBeFalsy();
        });
    
        it('Dynamic name should not be altered', async () => {
            // Build
            const datetime = Date.now();
            const resolvedInputParams = [{Key: 'Namespace', Value: `analysis-${datetime}`}];
    
            // Operate
            const after = await lp.checkNamespace(resolvedInputParams, datetime);
    
            // Check
            await expect(after[0].Value === resolvedInputParams[0].Value).toBeTruthy();
        });
    
        it('Static name that ends with a number sequence should be transformed to start with analysis- and end with number string that is unique and be unique between calls', async () => {
            // Build
            const resolvedInputParams = [{Key: 'Namespace', Value: 'staticname-2626262626'}];
            const datetime = Date.now();
    
            // Operate
            const after = await lp.checkNamespace(resolvedInputParams, datetime);
            const after2 = await lp.checkNamespace(resolvedInputParams, datetime);
    
            // Check
            const numberSequence = resolvedInputParams[0].Value.split('-').pop();
            await expect(after[0].Value.startsWith('analysis-')).toBeTruthy() && expect(Number(after[0].Value.split('-').pop())).not.toBe(NaN) && expect(after[0].Value.split('-').pop() === numberSequence).toBeFalsy() && expect(after === after2).toBeFalsy();
        });
    })
})
