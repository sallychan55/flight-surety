
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    
        // Fund airline
        DOM.elid('fund').addEventListener('click', async() => {
            let funds = DOM.elid('funds').value;
            contract.fund(funds, (error, result) => {
                display('', `Funds added`, [ { label: 'Funds added to airline: ', error: error, value: funds+" ETH"} ]);
                display('', '', [ { label: 'Airline Status: ', value: result.active} ]);
            });
        })

        // Registers flight
        DOM.elid('register-flight').addEventListener('click', () => {
            let flight = DOM.elid('new-flight').value;
            if(flight != '')
            {
                //Forward call to smart contract
                contract.registerFlight(flight, (error, result) => {
                    display('Register Flight', 'Trigger App contract', [ { label: 'Registration:', error: error,  value: 'Success - registered. ' } ]);
                });
            }
            
        });
    
        // Buys insurance
        DOM.elid('buy-insurance').addEventListener('click', () => {
            // Get User address from Metamask
            if (!contract.owner) {
                alert("You need to install and login to an Ethereum-compatible wallet or extension like MetaMask to use this dApp.");
            } else {
                let flight = DOM.elid('flight-number').value;
                let amount = DOM.elid('insurance-value').value;
                if(confirm('You are about to pay '+ amount +' Ethers for insuring your trip on flight '+flight+'. The amount will be deducted from the account: ' + contract.owner + '.\nAre you sure?'))
                {                    
                    //Forward call to smart contract
                    contract.buyInsurance(flight, amount, (error, result) => {
                        display('Buy Insurance', 'Trigger App contract', [ { label: 'Buying result:', error: error,  value: 'Success - insured ' + result.flight + ' with ' + result.amount + ' ethers.'} ]);
                    });
                }
            }        
        });

        // User submits oracle
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number-oracles').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                /*  Flight status codes:
                    STATUS_CODE_UNKNOWN = 0; 
                    STATUS_CODE_ON_TIME = 10;
                    STATUS_CODE_LATE_AIRLINE = 20;
                    STATUS_CODE_LATE_WEATHER = 30;
                    STATUS_CODE_LATE_TECHNICAL = 40;
                    STATUS_CODE_LATE_OTHER = 50;
                 */
                let status = '';
                switch(result)
                {
                    case '0': status = 'Unkown';  break;
                    case '10': status = 'On Time'; break;
                    case '20': status = 'Late- airline'; break;
                    case '30': status = 'Late- Weather'; break;
                    case '40': status = 'Late- Technical'; break;
                    case '50': status = 'Late- Other';
                }
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: flight+' - '+status} ]);
            });
        });

        let credit = 0;
        // Claim Insurance
        DOM.elid('claim-insurance').addEventListener('click', () => {
            let flight = DOM.elid('flight-number-claim').value;
            // Write transaction
            contract.claimInsurance(flight, (errorClaim, resultClaim) => {
                console.log("claimIns", errorClaim, resultClaim );                
                contract.getCredit((errorGet, resultGet) => {
                    console.log("getCredit", errorGet, resultGet );
                    credit = resultGet / Math.pow(10, 18); //convert from wei back to ether
                    display('Insurance Amount', 
                        (errorClaim? 'You cannot refund for flight ':'You can refund for flight ') + flight, 
                        [ { label: 'Total credit amount in Ether:', 
                            error: errorGet, 
                            value: JSON.stringify(credit),
                            insuranceCredit: credit
                        } ]);
                        DOM.elid('withdraw-credit').style.display = 'inline';
                    console.log('claimInsurance in contract.js returned result: ' + credit);
                });
            });
        });


        // Withdraw Credit
        let withdrawButton = DOM.elid('withdraw-credit');
        withdrawButton.style.display = 'none';

        withdrawButton.addEventListener('click', () => {
            //console.log('Withdraw button was clicked!'+ credit);   
            if(credit > 0)  //Make sure there is credit
            {
                if(confirm(credit +' Ethers are going to be transferred to this account: '+contract.owner+'\nPlease confirm.'))
                {
                    contract.withdraw((error, result) => {
                        if(!error){
                            console.log('You have been credited ' + credit + ' Ethers to your account.')
                            credit = 0; //reset the credit amount after withdawal -- to prevent misleading messages to the user
                            withdrawButton.style.display = 'none'; //Do not allow more withdrawals
                        }else
                            console.log('Withdraw function returned error: ' + error);
                    });
                }
            }
        });
    
    });   

})();

function getAccounts(callback) {
    web3.eth.getAccounts((error,result) => {
        if (error) {
            console.log(error);
        } else {
            callback(result);
        }
    });
}

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







