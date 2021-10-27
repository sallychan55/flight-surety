import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        //this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.fetched = []; 
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        } 
        self.flightSuretyApp.methods
                .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
                .send({ from: self.owner});

        let status = '99';
        //Listen to request for flight status from oracles event emitted by app contract       
        self.flightSuretyApp.events.OracleRequest({fromBlock: 'latest'}, 
            function(error,event) {
            if(error) console.log(error);
            console.log('Caught an event- Request oracles for flight status: ');
            console.log(event['returnValues']);
            //Wait for 2 seconds to allow all oracles to respond to this event, if not, inform user that the fetch failed
            setTimeout(function(){               
                if(status == '99')
                {
                    let error = 'Oracles did not reach a consensus. Sorry! Please try again.';
                    console.log(error);
                    callback(error, status);
                }
            }, 2000, flight );

            //Listen to updated flight status event emitted by app contract       
            self.flightSuretyApp.events.FlightStatusInfo({fromBlock: 'latest'}, 
            function(error,event) {
                if(error) console.log(error);
                console.log('Caught an event- Updated Flight status:');
                let eventValues = event['returnValues'];
                console.log(eventValues);
                self.updateFetched(eventValues['flight'], eventValues['timestamp']);
                status = eventValues['status'];
                callback(null, status);
            });
        });
    }

    //Keeps track of the last time a flight was fetched
    updateFetched(flight, timestamp)
    {
        let self = this;
        self.fetched[flight] = timestamp;
    }

    isFetched(flight){
        let self = this;

        if(self.fetched[flight] == 0  //Flight not fetched before
            || Math.floor(Date.now() / 1000) - self.fetched[flight] > 120 ) //Flight's last status updated more than 2 minutes ago
            return false; 
        else  return true;
    }

    buyInsurance(flight, amount, callback) {
        let self = this;
        let payload = {
            flight: flight,
            amount: amount
        } 
        amount *= Math.pow(10, 18); //convert amount from ethers to wei
        self.flightSuretyApp.methods
            .buyInsurance(payload.flight)
            .send({ from: self.owner, value: amount}, (error, result) => {
                callback(error, payload);
            });
    }
    
    claimInsurance(flight, callback){
        let self = this;
        let fetched = self.isFetched(flight);
        if(!fetched){
            self.fetchFlightStatus(flight, callback);
        } else {
            self.flightSuretyApp.methods
            .claimInsurance(flight)
            .send({from: self.owner}, callback);
        }    
    }

    getCredit(callback){
        let self = this;
        self.flightSuretyApp.methods
        .getCredit()
        .call({from: self.owner}, callback);
    }                    

    withdraw(callback){
        let self = this;
        //credit *= (new BigNumber(10)).pow(18);         //convert amount from ethers to wei
        self.flightSuretyApp.methods
        .withdrawCredit()
        .send({from: self.owner, gas: Config.gas}, callback);
    }

    fund(funds, callback) {
        let self = this;
        let value = this.web3.utils.toWei(funds.toString(), "ether");
        let payload = {
            funds: value,
            funder: self.owner,
            active: "false"
        }

        this.web3.eth.getAccounts((error, accts) => {
            payload.funder = accts[0];
        });                

        self.flightSuretyData.methods
        .fund()
        .send({ from: payload.funder, value: value }, (error_fund, result_fund) => {
            console.log(error_fund, result_fund);
            if (!error_fund){
                self.flightSuretyData.methods
                .registerAirline(self.owner)
                .send({ from: payload.funder}, (error_register, result_register) => {   
                    console.log(error_register, result_register);
                    if(!error_register){
                        self.flightSuretyData.methods.
                        isAirline(payload.funder)
                        .call({from: payload.funder}, (error, result) => {
                            if(!error){
                                payload.active = result;
                            }
                            callback(error, payload);
                        });
                    }
                });
            }
        });
    }

    registerFlight(flight, callback) {
        let self = this;
        self.flightSuretyApp.methods
        .registerFlight(flight)
        .send({from: this.airlines[0]}, (error, result) => {
            callback(error, flight);
        });
    }
}