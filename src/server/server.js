import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

let oracles = [];
var ORACLES_COUNT = 20, FIRST_ORACLE_ADDRESS, LAST_ORACLE_ADDRESS;

web3.eth.getAccounts().then(accounts => {
    if(accounts.length < ORACLES_COUNT) {
        console.log('\nServer Error - Not enough accounts to support oracles...\n'+
                    'You need at least ' + ORACLES_COUNT + ' to power up the oracles server.');
        return;
    }

    // Register 20 oracles
    FIRST_ORACLE_ADDRESS = accounts.length - ORACLES_COUNT - 1; 
    LAST_ORACLE_ADDRESS = ORACLES_COUNT + FIRST_ORACLE_ADDRESS;
    console.log('Ganache returned '+accounts.length+' accounts.');
    console.log('Server will use only '+ORACLES_COUNT+' of these accounts for oracles.');
    //console.log('Starting from accounts['+FIRST_ORACLE_ADDRESS+'] for the first oracle.');
    //console.log('Ending at accounts['+LAST_ORACLE_ADDRESS+'] for the last oracle.');

    // Initialize oracles
    flightSuretyApp.methods.REGISTRATION_FEE().call({
        "from": accounts[0],
        "gas": 4712388,
        "gasPrice": 100000000000
    }).then(fee => { 
        console.log('Smart Contract requires ('+fee+') wei to fund oracle registration.');
        for(var a = FIRST_ORACLE_ADDRESS;a<LAST_ORACLE_ADDRESS;a++){
            let account = accounts[a];
            oracles.push(account);
            console.log('Registering oracle: '+account);
            flightSuretyApp.methods.registerOracle().send({
                "from": account,
                "value": fee,
                "gas": 4712388,
                "gasPrice": 100000000000
            }).then(result => {
                console.log('Registered: '+account);
            }).catch(err => {
                console.log('Could not create oracle at address: '+account+'\n\tbecause: '+err);
            })
        } 

        // Display oracles addresses and indexes previously retrieved from smart contract
        oracles.forEach(oracle => {
            flightSuretyApp.methods
                .getMyIndexes().call({
                    "from": oracle,
                    "gas": 4712388,
                    "gasPrice": 100000000000
                }).then(result => {
                  console.log('Assigned Indices: '+result[0]+', '+result[1]+', '+result[2]+'\tfor oracle: '+oracle);
                }).catch(error => {
                  console.log('Could not retrieve oracle indices because: '+error);
                })
        }); 

    console.log('Oracles server all set-up.\nOracles registered and assigned addresses.');
    console.log('Listening to a request event');

    //Listen for oracleRequest event
    flightSuretyApp.events.OracleRequest({fromBlock: 'latest'}, 
    function(error, event) {
        if(error) console.log(error);
        console.log('Caught an event: ');
        let eventResult = event['returnValues'];
        console.log(eventResult);
        let index = eventResult['index'];
        let airline = eventResult['airline'];
        let flight = eventResult['flight'];
        let timestamp = eventResult['timestamp'];
        //console.log('Only the oracles with index '+index+' should respond to the request.');

        //Query the oracles with matching index for the flight status
        oracles.forEach(oracle => {
            flightSuretyApp.methods
            .getMyIndexes().call({
                "from": oracle,
                "gas": 4712388,
                "gasPrice": 100000000000
            }).then(result => {
                //matching oracle -> respond with random status
                if(result[0]==index || result[1]==index || result[2]==index) 
                {
                    let flightStatus = 10 * 2;//(1+Math.floor(Math.random() * 5)); 
                    /*  Flight status codes:
                        STATUS_CODE_UNKNOWN = 0;
                        STATUS_CODE_ON_TIME = 10;
                        STATUS_CODE_LATE_AIRLINE = 20;
                        STATUS_CODE_LATE_WEATHER = 30;
                        STATUS_CODE_LATE_TECHNICAL = 40;
                        STATUS_CODE_LATE_OTHER = 50;
                    */
                    console.log('[Status Update] Responding with random flight status: '+flightStatus+' from oracle: '+oracle);                                                    
                    flightSuretyApp.methods
                    .submitOracleResponse(index, airline,flight, timestamp, flightStatus).send({
                        "from": oracle,
                        "gas": 4712388,
                        "gasPrice": 100000000000
                    }).then(result => {
                        console.log('Oracle ['+oracle+'] response submitted successfully.') 
                    }).catch(error=>{
                        console.log('Could not submit oracle response because: '+error)
                    });
                  }
            }).catch(error => {
                console.log('Could not retrieve oracle indices because: '+error);
            })
        }); 
    });
  }).catch(err=>{console.log('Could not retrieve registration fee. '+err)});

});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


