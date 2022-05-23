const express = require('express');
const app = express();
const port = 8008;
const cliProgress = require('cli-progress');
const cronitor = require('cronitor')('cbaee3d8d9bb4bd090e5e26015a2813f');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const cron = require("node-cron");
const path = require("path");

const configDirectory = path.resolve(process.cwd());
const accountList = fs.readFileSync(path.join(configDirectory, 'account.txt'), 'utf8').split('\n');
const outputFilePathJson = path.join(configDirectory, 'accountData/data.json');
var txLimit = 50;
var hoursLimit = 1;
var tempRes;
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
var o = [];
var fullData = [];
const monitor = new cronitor.Monitor('ODA Wallet Inspect - Server');

async function callInspect(a, n) {
  tempRes = await inspectAccountTransaction(a);
  var account = {};
  account.account = a;
  account.tx = tempRes;
  fullData.push(account);
  let txs = fullData[n].tx;
  for (let i = 0; i < txs.length; i++) {
    let d = new Date(0);
    d.setUTCSeconds(+txs[i].blockTime);
    var hours = Math.abs(new Date() - d) / 36e5;
    if (hours < hoursLimit) {
      tempRes = await inspectTransaction(txs[i].txHash);
      var f = '';
      if (tempRes.logMessage == undefined
        || tempRes.tokenBalanes == undefined
        || tempRes.tokenBalanes[0] == undefined
        || tempRes.tokenBalanes[0].token == undefined
        || tempRes.tokenBalanes[0].token.tokenAddress == undefined) {
        continue;
      }
      if (tempRes.logMessage.join().includes('Instruction: Buy')) f = "bought";
      if (tempRes.logMessage.join().includes('Instruction: Sell')) f = "sold";
      if (f != '') {
        var tokenAddress = tempRes.tokenBalanes[0].token.tokenAddress;
        tempRes = await inspectToken(tokenAddress);
        if (!tempRes.name.includes("#")) { continue; }
        var data = {
          id: (n + 1),
          wallet: a,
          operazione: f,
          target: tempRes.name,
          date: formatDate(d),
          txHash: txs[i].txHash
        };
        o.push(data);
      }
    }
  }
}

async function inspectAccountTransaction(a) {
  await sleep(300);
  return new Promise(function(resolve, reject) {
    axios.get('https://public-api.solscan.io/account/transactions?account=' + a + '&limit=' + txLimit + '')
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        console.log("[ERROR] [inspectAccountTransaction] [" + a + "] " + error);
      });
  })
}

async function inspectTransaction(a) {
  await sleep(300);
  return new Promise(function(resolve, reject) {
    axios.get('https://public-api.solscan.io/transaction/' + a + '')
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        console.log("[ERROR] [inspectTransaction] [" + a + "] " + error);
      });
  })
}

async function inspectToken(a) {
  await sleep(300);
  return new Promise(function(resolve, reject) {
    axios.get('https://public-api.solscan.io/token/meta?tokenAddress=' + a + '')
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        console.log("[ERROR] [inspectToken] [" + a + "] " + error);
      });
  })
}

function padTo2Digits(num) {
  return num.toString().padStart(2, '0');
}

function formatDate(date) {
  return (
    [
      date.getFullYear(),
      padTo2Digits(date.getMonth() + 1),
      padTo2Digits(date.getDate()),
    ].join('-') +
    ' ' +
    [
      padTo2Digits(date.getHours()),
      padTo2Digits(date.getMinutes()),
      padTo2Digits(date.getSeconds()),
    ].join(':')
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

Date.prototype.addHours = function(h) {
  this.setTime(this.getTime() + (h * 60 * 60 * 1000));
  return this;
}

function createNewJson(data) {
  //read old json
  var oldJson = JSON.parse(fs.readFileSync(path.join(configDirectory, 'accountData/data.json')));
  oldJson = oldJson == '' ? [] : oldJson;
  //create new json 
  var newJson = oldJson.concat(data);
  //remove older than 24h
  newJson = newJson.filter(a => (Math.abs(new Date() - new Date(a.date)) / 36e5) < 24);
  //removing duplicate
  const set = new Set(newJson.map(item => JSON.stringify(item)));
  newJson = [...set].map(item => JSON.parse(item));
  return newJson;
}

/* ---------------- RUN SOFTWARE ----------------- */

async function run() {
  o = [];
  monitor.ping({ state: 'run' });
  try {
    console.log("Inizio [" + formatDate(new Date().addHours(2)) + "]");
    var counter = 0;
    for (const item of accountList) {
      await callInspect(item, counter);
      counter++;
    };
    var newJson = createNewJson(o);
    fs.writeFileSync(outputFilePathJson, JSON.stringify(newJson),
      { encoding: 'utf8', flag: 'w' }
    );
    console.log("Fine [L: " + o.length + "] [" + formatDate(new Date().addHours(2)) + "]");
    monitor.ping({ state: 'complete' });
  } catch (e) {
    monitor.ping({ state: 'fail' });
  }
}

app.get('/scan', (req, res) => {
  fs.readFile(path.join(configDirectory, 'accountData/data.json'), (err, json) => {
    if (json == '') {
      res.send("Ciao")
    } else {
      let obj = JSON.parse(json);
      res.json(obj);
    }
  });
});

cron.schedule('45 * * * *', () => {
  console.log('Updating json [' + new Date().addHours(2) + ']');
  run();
});

app.get('/', (req, res) => res.send(`I'm alive!`));

app.listen(port, () => {
  run();
});

app.use(cors());