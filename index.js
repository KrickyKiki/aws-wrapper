const AWS = require('aws-sdk');
const DynamoDB = new AWS.DynamoDB({ apiVersion: '2012-10-08' });
const S3 = new AWS.S3({apiVersion: '2010-12-01'});
const EC2 = new AWS.EC2({apiVersion: '2016-11-15'});
const Lambda = new AWS.Lambda();

Object.prototype.empty = function () {
  return JSON.stringify({}) == JSON.stringify(this);
};

Array.prototype.empty = function () {
  return this.length === 0;
};

const DefaultLimits = {
  Read: 5,
  Write: 5
};

let Limits = {};

let Queue = {};
let Count = {};
let Watcher = {};
let Strikes = {};
let FinishCallbacks = {};

const LimitManager = {
  newRead: (TableName) => {
    Count[TableName].Read++;
  },
  newWrite: (TableName) => {
    Count[TableName].Write++;
  },
  canRead: (TableName) => {
    return Count[TableName].Read < Limits[TableName].Read;
  },
  canWrite: (TableName) => {
    return Count[TableName].Write < Limits[TableName].Write;
  },
  readQueueEmpty: (TableName) => {
    return Queue[TableName].Read.empty();
  },
  writeQueueEmpty: (TableName) => {
    return Queue[TableName].Write.empty();
  },
  addToReadQueue: (TableName, func) => {
    Queue[TableName].Read.push(func);
  },
  addToWriteQueue: (TableName, func) => {
    Queue[TableName].Write.push(func);
  },
  startLimitWatch: (TableName) => {
    Count[TableName] = {
      Read: 0,
      Write: 0
    };
    Queue[TableName] = {
      Read: [],
      Write: []
    };
    Strikes[TableName] = 0;
    FinishCallbacks[TableName] = [];
    Watcher[TableName] = {
      start: setInterval(() => {
        Count[TableName].Read = 0;
        Count[TableName].Write = 0;
        if (LimitManager.readQueueEmpty(TableName) && LimitManager.writeQueueEmpty(TableName)) {
          Strikes[TableName]++;
          if (Strikes[TableName] == 2) {
            LimitManager.stopLimitWatch(TableName);
          }
        } else {
          Strikes[TableName] = 0;
          for (let i = 0; i < Queue[TableName].Read.length; i++) {
            if (LimitManager.canRead(TableName)) {
              Queue[TableName].Read[i](() => {
                Queue[TableName].Read.splice(i, 1);
              });
            } else {
              break;
            }
          }
          for (let i = 0; i < Queue[TableName].Write.length; i++) {
            if (LimitManager.canWrite(TableName)) {
              Queue[TableName].Write[i](() => {
                Queue[TableName].Write.splice(i, 1);
              });
            } else {
              break;
            }
          }
        }
      }, 1000)
    };
  },
  stopLimitWatch: (TableName) => {
    if (!LimitManager.isStartLimitSet(TableName)) throw new Error('Watcher Not Started');
    Watcher[TableName].stop = setInterval(() => {
      if (LimitManager.readQueueEmpty(TableName) && LimitManager.writeQueueEmpty(TableName)) {
        Count[TableName] = null;
        Queue[TableName] = null;
        clearInterval(Watcher[TableName].start);
        clearInterval(Watcher[TableName].stop);
        for (let i = 0, l = FinishCallbacks[TableName].length; i < l; i++) {
          FinishCallbacks[TableName][i]();
        }
        FinishCallbacks[TableName] = [];
      }
    }, 1000);
  },
  isStopLimitSet: (TableName) => {
    return Watcher[TableName] && Watcher[TableName].stop;
  },
  isStartLimitSet: (TableName) => {
    return Watcher[TableName] && Watcher[TableName].start;
  }
};

let Table = function (TableName) {
  this.TableName = TableName;
  this.query = function (args, callback) {
    args.TableName = this.TableName;
    main.DynamoDB.query(args, callback);
    return this;
  },
  this.scan = function (args1, args2) {
    let args, callback;
    if (args2) {
      args = args1;
      args.TableName = this.TableName;
      callback = args2;
    } else {
      args = {
        TableName: this.TableName
      }
      callback = args1;
    }
    main.DynamoDB.scan(args, callback);
    return this;
  },
  this.getItem = function (args, callback) {
    args.TableName = this.TableName;
    main.DynamoDB.getItem(args, callback);
    return this;
  };
  this.putItem = function (args, callback) {
    args.TableName = this.TableName;
    main.DynamoDB.putItem(args, callback);
    return this;
  };
  this.putItems = function (args, callback) {
    args.TableName = this.TableName;
    main.DynamoDB.putItems(args, callback);
    return this;
  };
  this.getItems = function (args, callback) {
    args.TableName = this.TableName;
    main.DynamoDB.getItems(args, callback);
    return this;
  },
  this.setReadLimit = function (args) {
    args.TableName = this.TableName;
    main.DynamoDB.setReadLimit(args);
    return this;
  };
  this.setWriteLimit = function (args) {
    args.TableName = this.TableName;
    main.DynamoDB.setWriteLimit(args);
    return this;
  };
  this.setLimits = function (args) {
    args.TableName = this.TableName;
    main.DynamoDB.setLimits(args);
    return this;
  };
  this.determineLimits = function (callback) {
    main.DynamoDB.determineLimits({
      TableName: this.TableName
    }, callback);
    return this;
  };
  this.startLimitWatch = function () {
    main.DynamoDB.startLimitWatch({
      TableName: this.TableName
    });
    return this;
  };
  this.stopLimitWatch = function () {
    main.DynamoDB.stopLimitWatch({
      TableName: this.TableName
    });
    return this;
  };
  this.onFinish = function (callback) {
    main.DynamoDB.onFinish({
      TableName: this.TableName
    }, callback);
    return this;
  };
  return this;
};

const main = {
  get: {
    AWS: () => AWS,
    Lambda: () => Lambda,
    DynamoDB: () => DynamoDB,
    EC2: () => EC2,
    S3: () => S3
  },
  Lambda: {
    invoke: (args, callback) => {
      if (!args.FunctionName) throw new Error('Missing Param: FunctionName');
      Lambda.invoke(args, (err, data) => {
        if (err) throw new Error(err);
        callback(data);
      });
      return main.Lambda;
    }
  },
  S3: {
    getObject: (args, callback) => {
      if (!args.Bucket) throw new Error("Missing param: Bucket");
      if (!args.Key) throw new Error("Missing param: Key");
      S3.getObject(args, (err, data) => {
        if (err.code == 'NoSuchKey') {
          callback(null);
        } else {
          if (err) throw new Error(err);
          callback(data.Body.toString());
        }
      });
      return main.S3;
    },
    putObject: (args, callback) => {
      if (!args.Bucket) throw new Error("Missing param: Bucket");
      if (!args.Key) throw new Error("Missing param: Key");
      if (!args.Body) throw new Error("Missing param: Body");
      args.Body = new Buffer(args.Body, 'binary');
      S3.putObject(args, (err, data) => {
        if (err) throw new Error(err);
        if (callback) callback(data);
      });
      return main.S3;
    }
  },
  DynamoDB: {
    query: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      let Items = [];
      let query = (ExclusiveStartKey) => {
        if (ExclusiveStartKey)
          args.ExclusiveStartKey = ExclusiveStartKey;
        DynamoDB.query(args, (err, data) => {
          if (err) throw new Error(err);
          for (let i = 0, l = data.Items.length; i < l; i++)
            Items.push(data.Items[i]);
          if (data.LastEvaluatedKey)
            query(data.LastEvaluatedKey);
          else
            callback(Items);
        });
      };
      query(null);
    },
    scan: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      let Items = [];
      let scan = (ExclusiveStartKey) => {
        if (ExclusiveStartKey)
          args.ExclusiveStartKey = ExclusiveStartKey;
        DynamoDB.scan(args, (err, data) => {
          if (err) throw new Error(err);
          for (let i = 0, l = data.Items.length; i < l; i++)
            Items.push(data.Items[i]);
          if (data.LastEvaluatedKey)
            scan(data.LastEvaluatedKey);
          else
            callback(Items);
        });
      };
      scan(null);
    },
    getItem: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Key) throw new Error("Missing param: Key");
      LimitManager.addToReadQueue(args.TableName, (requestDone) => {
        let Item = null;
        DynamoDB.getItem(args, (err, data) => {
          if (err) throw new Error(err);
          if (!data.empty())
            Item = data.Item;
          requestDone();
          callback(Item);
        });
        LimitManager.newRead(args.TableName);
      });
      return main.DynamoDB;
    },
    putItem: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Item) throw new Error("Missing param: Item");
      LimitManager.addToWriteQueue(args.TableName, (requestDone) => {
        DynamoDB.putItem(args, (err, data) => {
          if (err) throw new Error(err);
          requestDone();
          if (callback) callback(data);
        });
        LimitManager.newWrite(args.TableName);
      });
      return main.DynamoDB;
    },
    putItems: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Items) throw new Error("Missing param: Items");
      for (let i = 0; i < args.Items.length; i++) {
        main.DynamoDB.putItem({
          TableName: args.TableName,
          Item: args.Items[i]
        });
      }
      if (callback)
        main.DynamoDB.onFinish(args, () => {
          callback()});
      return main.DynamoDB;
    },
    getItems: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Keys) throw new Error("Missing param: Keys");
      let Items = [];
      for (let i = 0; i < args.Keys.length; i++) {
        main.DynamoDB.getItem({
          TableName: args.TableName,
          Key: args.Keys[i]
        }, (Item) => {
          if (Item)
            Items.push(Item);
        });
      }
      FinishCallbacks[args.TableName].push(() => {
        callback(Items);
      });
    },
    setReadLimit: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Limit) throw new Error("Missing param: Limit");
      if (Limits[args.TableName])
        Limits[args.TableName].Read = args.Limit;
      else
        Limits[args.TableName] = {
          Read: args.Limit,
          Write: DefaultLimits.Write
        };
      return main.DynamoDB;
    },
    setWriteLimit: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Limit) throw new Error("Missing param: Limit");
      if (Limits[args.TableName])
        Limits[args.TableName].Write = args.Limit;
      else
        Limits[args.TableName] = {
          Write: args.Limit,
          Read: DefaultLimits.Read
        };
      return main.DynamoDB;
    },
    setLimits: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!args.Read) throw new Error("Missing param: Read");
      if (!args.Write) throw new Error("Missing param: Write");
      if (Limits[args.TableName]) {
        Limits[args.TableName].Read = args.Read;
        Limits[args.Tablename].Write = args.Write;
      } else {
        Limits[args.TableName] = {
          Read: args.Read,
          Write: args.Write
        };
      }
      return main.DynamoDB;
    },
    determineLimits: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      DynamoDB.describeTable(args, (err, data) => {
        if (err) throw new Error(err);
        Limits[args.TableName] = {
          Read: data.Table.ProvisionedThroughput.ReadCapacityUnits,
          Write: data.Table.ProvisionedThroughput.WriteCapacityUnits
        };
        if (callback) callback(data);
      });
      return main.DynamoDB;
    },
    startLimitWatch: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      if (!Limits[args.TableName]) {
        Limits[args.TableName] = {
          Read: DefaultLimits.Read,
          Write: DefaultLimits.Write
        };
      }
      LimitManager.startLimitWatch(args.TableName);
      return main.DynamoDB;
    },
    stopLimitWatch: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      LimitManager.stopLimitWatch(args.TableName);
      return main.DynamoDB;
    },
    onFinish: (args, callback) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      FinishCallbacks[args.TableName].push(callback);
      if (!LimitManager.isStopLimitSet(args.TableName))
        LimitManager.stopLimitWatch(args.TableName);
      return main.DynamoDB;
    },
    Table: (args) => {
      if (!args.TableName) throw new Error("Missing param: TableName");
      return new Table(args.TableName);
    }
  }
};

module.exports = main;