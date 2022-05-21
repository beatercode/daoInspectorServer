const express = require('express');
const app = express();
const port = 8008;
const cliProgress = require('cli-progress');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const cron = require("cron");
var path = require("path");
const configDirectory = path.resolve(process.cwd());

const accountList = fs.readFileSync(path.join(configDirectory, 'account.txt'), 'utf8').split('\n');
const outputFilePathJson = path.join(configDirectory, 'accountData/data.json');
var txLimit = 40;
var hoursLimit = 1;
var tempRes;
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
var o = [];

async function callInspect(a, n) {
    tempRes = await inspectAccountTransaction(a);
    var account = [];
    var data = [];
    account.push(a);
    account.push(tempRes);
    data.push(account);
    let txs = data[0][1];
    for (let i = 0; i < txs.length; i++) {
        let d = new Date(0);
        d.setUTCSeconds(+txs[i].blockTime);
        var hours = Math.abs(d - new Date()) / 36e5;
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
                //var dataToAppend = "[" + (n + 1) + "] [" + a + "] " + f + " " + tempRes.name + " [" + formatDate(d) + "] TX[" + txs[i].txHash + "]\r\n";
                //fs.appendFileSync(outputFilePath, dataToAppend);
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
        //bar.increment();
    }
}

async function inspectAccountTransaction(a) {
    await sleep(300);
    return new Promise(function (resolve, reject) {
        axios.get('https://public-api.solscan.io/account/transactions?account=' + a + '&limit=' + txLimit + '')
            .then(response => {
                resolve(JSON.parse(JSON.stringify(response.data)));
            })
            .catch(error => {
                //fs.appendFileSync(outputFilePath, "-- [Warning] -- [" + a + "] check\r\n");
                //bar.increment();
            });
    })
}

async function inspectTransaction(a) {
    await sleep(300);
    return new Promise(function (resolve, reject) {
        axios.get('https://public-api.solscan.io/transaction/' + a + '')
            .then(response => {
                resolve(JSON.parse(JSON.stringify(response.data)));
            })
            .catch(error => {
                //fs.appendFileSync(outputFilePath, "-- [Warning] -- [" + a + "] check\r\n");
                //bar.increment();
            });
    })
}

async function inspectToken(a) {
    await sleep(300);
    return new Promise(function (resolve, reject) {
        axios.get('https://public-api.solscan.io/token/meta?tokenAddress=' + a + '')
            .then(response => {
                resolve(JSON.parse(JSON.stringify(response.data)));
            })
            .catch(error => {
                //fs.appendFileSync(outputFilePath, "-- [Warning] -- [" + a + "] check\r\n");
                //bar.increment();
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

/* ---------------- RUN SOFTWARE ----------------- */

async function run() {
    console.log(configDirectory);
    //fs.truncate(outputFilePath, 0, function () { });
    //bar.start(accountList.length * txLimit);
    console.log("Inizio [" + formatDate(new Date()) + "]");
    var counter = 0;
    for (const item of accountList) {
        await callInspect(item, counter);
        counter++;
    };
    //console.log("Done [" + formatDate(new Date()) + "]");
    fs.writeFileSync(outputFilePathJson, JSON.stringify(o), {
        encoding: 'utf8',
        flag: 'w'
    })
    //bar.update(accountList.length * txLimit);
    //bar.stop();
    //console.log("Account analyzed: " + accountList.length);
    //console.log("Account failed: " + inspectedFailed);
}

run();
const job = new cron.CronJob('0 0 1 * * *', () => {
    run();
});

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

app.listen(port, () => {
})

app.use(cors());