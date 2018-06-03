# AWS Wrapper

- Makes DynamoDB capacity management just a bit easier

### Installation

```sh
$ npm install https://github.com/KrickyKiki/aws-wrapper
```
### Examples
```

AWSw.DynamoDB.setReadLimit({
  TableName: 'mytable',
  Read: 20
});

AWSw.DynamoDB.setWriteLimit({
  TableName: 'mytable',
  Write: 20
});

// OR

AWSw.DynamoDB.setLimits({
  TableName: 'mytable',
  Read: 20,
  Write: 20
});

// OR

AWSw.DynamoDB.determineLimits({
  TableName: 'mytable'
});



AWSw.DynamoDB.startLimitWatch({
  TableName: 'mytable'
});

AWSw.DynamoDB.getItem({
  TableName: 'mytable',
  Key: {'mykey': {S: 'myvalue'}}
}, (data) => {
  
})

AWSw.DynamoDB.putItem({
  TableName: 'mytable',
  Item: {
    'mykey': {S: 'myvalue'}
  }
});

for (let i = 0, l = 1000; i < l; i++) {
  AWSw.DynamoDB.putItem({
    TableName: 'mytable',
    Item: {
      'mykey': {S: `test${i}`}
    }
  });
}

AWSw.DynamoDB.stopLimitWatch({
  TableName: 'mytable'
});

// OR

AWSw.DynamoDB.onFinish({
  TableName: 'mytable'
}, () => {
  // done
});



// Alternative

let Table = AWSw.DynamoDB.Table({
  TableName: 'mytable'
}).determineLimits().startLimitWatch();

for (let i = 0, l = 1000; i < l; i++) {
  Table.putItem({
    Item: {
      'mykey': {S: `test${i}`}
    }
  });
}

Table.onFinish(() => {
  // done
})

// OR

let Table = AWSw.DynamoDB.Table({
  TableName: 'mytable'
}).determineLimits().startLimitWatch();

let Items = [];
for (let i = 0, l = 1000; i < l; i++) {
  Items.push({
    'mykey': {S: `test${i}`}
  });
}

Table.putItems({
  Items: Items
}, () => {
  // done
});


// Access original modules

const AWS = AWSw.get.AWS(); // expose AWS
const Lambda = AWSw.get.Lambda(); // expose Lambda
const DynamoDB = AWSw.get.DynamoDB(); // expose DynamoDB
const EC2 = AWSw.get.EC2(); // expose EC2
const S3 = AWSw.get.S3(); // expose S3
```