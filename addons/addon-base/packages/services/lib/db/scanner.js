const _ = require('lodash');

const unmarshal = require('./unmarshal');

// To handle scan operation using DocumentClient
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
// NOTE: The following properties are legacy and should not be used:
//  - AttributesToGet
//  - AttributeUpdates
//  - ConditionalOperator
//  - Expected
//  - ScanFilter

class DbScanner {
  constructor(log = console, client) {
    this.log = log;
    this.client = client;
    this.params = {
      // ReturnConsumedCapacity: 'INDEXES',
    };
  }

  // same as TableName
  table(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbScanner.table("${name}" <== must be a string and can not be empty).`);
    this.params.TableName = name;
    return this;
  }

  // same as IndexName
  index(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbScanner.index("${name}" <== must be a string and can not be empty).`);
    this.params.IndexName = name;
    return this;
  }

  // can be either props(key, value) or props({ key1: value1, key2: value2, ...})
  props(...args) {
    if (args.length > 1) this.params[args[0]] = args[1];
    else Object.assign(this.params, ...args);
    return this;
  }

  // same as ExclusiveStartKey
  start(key) {
    if (!key) delete this.params.ExclusiveStartKey;
    else this.params.ExclusiveStartKey = key;

    return this;
  }

  // same as FilterExpression
  filter(str) {
    if (this.params.FilterExpression) this.params.FilterExpression = `${this.params.FilterExpression} ${str}`;
    else this.params.FilterExpression = str;
    return this;
  }

  // same as ConsistentRead = true
  strong() {
    this.params.ConsistentRead = true;
    return this;
  }

  // same as ExpressionAttributeNames
  names(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbScanner.names("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeNames = {
      ...this.params.ExpressionAttributeNames,
      ...obj,
    };
    return this;
  }

  // same as ExpressionAttributeValues
  values(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbScanner.values("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeValues = {
      ...this.params.ExpressionAttributeValues,
      ...obj,
    };
    return this;
  }

  // same as ProjectionExpression
  projection(expr) {
    if (_.isEmpty(expr)) return this;
    if (_.isString(expr)) {
      if (this.params.ProjectionExpression)
        this.params.ProjectionExpression = `${this.params.ProjectionExpression}, ${expr}`;
      else this.params.ProjectionExpression = expr;
    } else if (_.isArray(expr)) {
      const names = {};
      const values = [];
      expr.forEach(key => {
        names[`#${key}`] = key;
        values.push(`#${key}`);
      });
      const str = values.join(', ');
      if (this.params.ProjectionExpression)
        this.params.ProjectionExpression = `${this.params.ProjectionExpression}, ${str}`;
      else this.params.ProjectionExpression = str;
      this.params.ExpressionAttributeNames = {
        ...this.params.ExpressionAttributeNames,
        ...names,
      };
    } else throw new Error(`DbScanner.projection("${expr}" <== must be a string or an array).`);

    return this;
  }

  // same as Select: ALL_ATTRIBUTES | ALL_PROJECTED_ATTRIBUTES | SPECIFIC_ATTRIBUTES | COUNT
  select(str) {
    const upper = str.toUpperCase();
    const allowed = ['ALL_ATTRIBUTES', 'ALL_PROJECTED_ATTRIBUTES', 'SPECIFIC_ATTRIBUTES', 'COUNT'];
    if (!allowed.includes(upper))
      throw new Error(`DbScanner.select("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.Select = upper;
    return this;
  }

  // same as Limit
  limit(num) {
    this.params.Limit = num;
    return this;
  }

  // same as Segment
  segment(num) {
    this.params.Segment = num;
    return this;
  }

  // same as TotalSegments
  totalSegment(num) {
    this.params.TotalSegment = num;
    return this;
  }

  // same as ReturnConsumedCapacity
  capacity(str = '') {
    const upper = str.toUpperCase();
    const allowed = ['INDEXES', 'TOTAL', 'NONE'];
    if (!allowed.includes(upper))
      throw new Error(
        `DbScanner.capacity("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`,
      );
    this.params.ReturnConsumedCapacity = upper;
    return this;
  }

  async scan() {
    let count = 0;
    let result = [];

    const done = () => {
      const limit = this.params.Limit;
      if (this.params.ExclusiveStartKey === undefined) return true;
      if (limit === undefined) return false;
      return limit <= count;
    };

    // An example of an output of one "this.client.scan()" call
    // {
    //   "Items": [
    //       {
    //           "firstName": "Alan",
    //           "lastName": "Turing",
    //           "username": "alan"
    //       }
    //   ],
    //   "Count": 1,
    //   "ScannedCount": 1,
    //   "LastEvaluatedKey": {
    //       "username": "alan"
    //   }
    // }

    do {
      const data = await this.client.scan(this.params).promise(); // eslint-disable-line no-await-in-loop

      this.params.ExclusiveStartKey = data.LastEvaluatedKey;
      count += data.Count;
      if (data.Count > 0) {
        result = _.concat(result, unmarshal(data.Items));
      }
    } while (!done());

    return result;
  }
}

module.exports = DbScanner;
