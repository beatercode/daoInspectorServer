const express = require('express');
const app = express();
const cronitor = require('cronitor')('cbaee3d8d9bb4bd090e5e26015a2813f');
const fs = require('fs');
const axios = require('axios');
const cron = require("node-cron");
const path = require("path");

let txLimit = 30;
let hoursLimit = 6;
let maxHstored = 120;
let cronSchedule = '55 * * * *';

const log4js = require("log4js");
logger = log4js.getLogger();
log4js.configure({
  appenders: {
    appender: {
      type: 'file',
      filename: 'log/log',
      keepFileExt: true,
      compress: true,
      pattern: 'yyyy-MM-dd.log',
      alwaysIncludePattern: true,
    },
  },
  categories: {
    default: {
      appenders: ['appender'],
      level: 'all',
    },
  },
});

const configDirectory = path.resolve(process.cwd());
const accountList = fs.readFileSync(path.join(configDirectory, 'account.txt'), 'utf8').split('\n');
const outputFilePathJson = path.join(configDirectory, 'accountData/data.json');
let tempRes;
let o = [];
let lastOldJson_len = 0;
let lastNewJson_len = 0;
let lastNewJsonNoOld_len = 0;
let lastNewJsonNoOldNoDupe_len = 0;

const monitor = new cronitor.Monitor('ODA Wallet Inspect - Server');

async function callInspect(a, n) {
  //logger.info("[callInspect] START with [" + (n + 1) + "]");
  tempRes = await inspectAccountTransaction(a);
  if (tempRes.result == null) return;
  let txs = tempRes.result;
  //logger.debug("[" + (n + 1) + "] callInspect | inspect done | txs [" + txs.length + "]");
  let nftSpotted = 0;
  for (let i = 0; i < txs.length; i++) {
    let d = new Date(0);
    d.setUTCSeconds(+txs[i].blockTime);
    d.addHours(2);
    let hours = Math.abs(new Date().addHours(2) - d.addHours(4)) / 36e5;
    //logger.debug("Math abs (" + new Date().addHours(2) + ") - (" + d + ") = (" + hours + ")");
    //logger.debug("N[" + (n + 1) + "][" + (i+ 1) + "]_[" + hours.toFixed(2) + "][" + hoursLimit + "]");
    if (i == 0 && firstTransactionOut(n, hours.toFixed(2), hoursLimit)) return;
    if (parseFloat(hoursLimit) > parseFloat(hours)) {
      //tempRes = await inspectTransaction(txs[i].txHash);
      tempRes = await inspectTransaction(txs[i].signature);
      if (tempRes == null) continue;
      if (tempRes.result == undefined
        || tempRes.result.meta == undefined
        || tempRes.result.meta.logMessages == undefined
        || tempRes.result.meta.preTokenBalances == undefined
        || tempRes.result.meta.preTokenBalances[0] == undefined
        || tempRes.result.meta.preTokenBalances[0].mint == undefined) {
        continue;
      }
      let logMessage = tempRes.result.meta.logMessages;
      let op = getNftTransaction(logMessage);
      if (op != '') {
        nftSpotted++;
        //logger.debug("[" + (n + 1) + "][" + (i + 1) + "] Spotted NFT [" + hours.toFixed(2) + "][" + hoursLimit + "]")
        let tokenAddress = tempRes.result.meta.preTokenBalances[0].mint;
        tempRes = await inspectToken(tokenAddress);
        if (tempRes == null) continue;
        if (!tempRes.name.includes("#")) { continue; }
        let data = {
          id: (n + 1),
          wallet: a,
          operazione: op,
          target: tempRes.name,
          date: formatDate(d),
          //txHash: txs[i].txHash
          txHash: txs[i].signature
        };
        //logger.debug("[" + n + "] callInspect | add data");
        o.push(data);
      }
    }
  }
  if (nftSpotted > 0) {
    logger.debug("[" + (n + 1) + "]_NFT SPOTTED [" + nftSpotted + "]");
  }
}

async function inspectAccountTransaction(a) {
  await sleep(400);
  return new Promise(function(resolve, reject) {
    axios({
      method: 'post',
      url: 'https://solana-api.projectserum.com',
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [
          a,
          {
            "limit": txLimit
          }
        ]
      }
    })
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        logger.error("[ERROR] [inspectAccountTransaction] [" + a + "] " + error);
        resolve(null);
      });
  });
}

async function inspectTransaction(a) {
  await sleep(400);
  return new Promise(function(resolve, reject) {
    axios({
      method: 'post',
      url: 'https://solana-api.projectserum.com',
      data: {
        jsonrpc: '2.0',
        id: '1',
        method: "getTransaction",
        params: [
          a,
          "json"
        ]
      }
    })
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        logger.error("[ERROR] [inspectTransaction] [" + a + "] " + error);
        resolve(null);
      });
  })
}

async function inspectToken(a) {
  await sleep(500);
  return new Promise(function(resolve, reject) {
    axios.get('https://public-api.solscan.io/token/meta?tokenAddress=' + a + '')
      .then(response => {
        resolve(JSON.parse(JSON.stringify(response.data)));
      })
      .catch(error => {
        logger.error("[ERROR] [inspectToken] [" + a + "] " + error);
        resolve(null);
      });
  })
}

function getNftTransaction(logMessage) {
  let f = '';
  if (logMessage.join().includes('Instruction: Buy')) f = "bought";
  if (logMessage.join().includes('Instruction: Sell')) f = "sold";
  return f;
}

function firstTransactionOut(n, hours, hoursLimit) {
  if (parseFloat(hoursLimit) > parseFloat(hours)) {
    return false;
  }
  logger.debug("[" + (n + 1) + "]_OUT_[" + parseFloat(hours).toFixed(2) + "][" + hoursLimit + "]");
  return true;
}

function createNewJson(result) {
  logger.info("createNewJson | start", 0);
  try {
    let pathf = path.join(configDirectory, 'accountData/data.json');
    logger.debug("createNewJson | reading path [" + pathf + "]")
    let oldJson = fs.readFileSync(pathf);
    logger.debug("createNewJson | readed");
    try {
      oldJson = JSON.parse(oldJson);
      logger.debug("createNewJson | parsed");
      oldJson = oldJson == '' ? [] : oldJson;
    } catch (e) { oldJson = []; }
    lastOldJson_len = oldJson.length;
    logger.debug("createNewJson | concat");
    let newJson = oldJson.concat(result);
    lastNewJson_len = newJson.length;
    logger.debug("createNewJson | remove old | max hours stored [" + maxHstored + "]");
    let noOld = newJson.filter(a => (Math.abs(new Date() - new Date(a.date)) / 36e5) < maxHstored);
    lastNewJsonNoOld_len = noOld.length;
    logger.debug("createNewJson | remove dupe");
    let seenHash = {};
    let noDupe = noOld.filter((obj, pos, arr) => {
      return arr.map(mapObj =>
        mapObj.txHash).indexOf(obj.txHash) == pos;
    });
    lastNewJsonNoOldNoDupe_len = noDupe.length;
    logger.info("createNewJson | done");
    return noDupe;
  } catch (e) { console.log("ETFFF: " + e) }
}

/* ---------------- RUN SOFTWARE ----------------- */

async function run() {
  o = [];
  monitor.ping({ state: 'run' });
  try {
    console.log("Inizio [" + formatDate(new Date().addHours(2)) + "]");
    logger.info("Inizio [" + formatDate(new Date().addHours(2)) + "]");
    let counter = 0;
    for (const item of accountList) {
      await callInspect(item, counter);
      counter++;
    };
    let newJson = createNewJson(o);
    fs.writeFileSync(outputFilePathJson, JSON.stringify(newJson),
      { encoding: 'utf8', flag: 'w' }
    );
    let recapString = "Fine " +
      "[OLD JSON: " + lastOldJson_len + "] " +
      "[NEW DATA: " + JSON.parse(JSON.stringify(o)).length + "] " +
      "[NEW JSON: " + lastNewJson_len + "] " +
      "[NEW J. NO OLD: " + lastNewJsonNoOld_len + "] " +
      "[NEW J. NO DUPE: " + lastNewJsonNoOldNoDupe_len + "] " +
      "[" + formatDate(new Date().addHours(2)) + "]";
    console.log(recapString);
    logger.debug(recapString);
    monitor.ping({ state: 'complete' });
  } catch (e) {
    logger.error(e);
    monitor.ping({ state: 'fail' });
  }
}

app.get('/scan', (req, res) => {
  fs.readFile(path.join(configDirectory, 'accountData/data.json'), (err, json) => {
    if (json == '') {
      res.send('[]');
    } else {
      let obj = JSON.parse(json);
      res.json(obj);
    }
  });
});

cron.schedule(cronSchedule, () => {
  logger.info("Trigger Cron Schedule");
  run();
});

app.get('/', (req, res) => res.send(`I'm alive!`));

app.listen(3000, () => {
  logger.info("Listening on port 3000 - run");
  run();
});

/* ------- utils ------- */

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

function formatDateShort(date) {
  return (
    [
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
