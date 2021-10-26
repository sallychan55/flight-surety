pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    struct Airline{
        bytes name;
        bool isRegistered;
        bool isFunded;
        uint256 balance;
    }
    mapping(address => Airline) private airlines;                     //Airlines are contract accounts, so we represent them as addresses.
                                                                      //Another approach can be to make a struct Airline. But let's keep it simple.
    uint256 private airlinesCount;                                    //The number of registered airlines.
    mapping(address => bool) private authorizedCallers; 

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address firstAirline
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        airlines[firstAirline].isRegistered = true;
        airlines[firstAirline].isFunded = false; 
        airlinesCount = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller()
    {
        require(authorizedCallers[msg.sender], "Caller is not authorized");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (
                                address airline   
                            )
                            external
                            requireIsOperational
    {
        airlines[airline].isRegistered = true;

        if(airlines[airline].balance >= 10 ether){
            airlines[airline].isFunded = true;
        }

        airlinesCount++;        
    }

    struct insuredFlights{
        mapping(bytes32 => uint) insuranceDetails; //stores how much did the customer insure for each flight
    }

    mapping(address => insuredFlights) allInsuredFlights;
    mapping(address => uint) payouts; //Amounts owed to insurees but have not yet been credited to their accounts

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (
                                address customer,
                                bytes32 flight,
                                uint amount                             
                            )
                            external
                            payable
                            requireIsOperational
    {
        require(allInsuredFlights[customer].insuranceDetails[flight] == 0, 'This flight is already insured by this customer');
        allInsuredFlights[customer].insuranceDetails[flight] = amount;
        allInsuredFlights[customer].insuranceKeys.push(flight);        
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    bytes32 flight,
                                    address insuree
                                )
                                external
                                requireIsOperational
                                returns(uint credit)
    {
        credit = allInsuredFlights[insuree].insuranceDetails[flight];
        require(credit > 0,
                'You either did not insure this flight from before, or you have already claimed the credit for this flight.');

        allInsuredFlights[insuree].insuranceDetails[flight] = 0;
        credit = credit.mul(3);
        credit = credit.div(2);
        require(allInsuredFlights[insuree].insuranceDetails[flight] == 0, 'Could not payout your credit');

        payouts[insuree] = payouts[insuree].add(credit);
        require(payouts[insuree] > 0, 'Unable to add your credit to the payout system');        
    }
    
    function getCredit
                        (
                            address insuree
                        )
                        external
                        view
                        returns(uint credit)
    {
        credit = payouts[insuree];
        return credit;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                address insuree
                            )
                            external
                            requireIsOperational
    {
        uint credit = payouts[insuree];
        //1. Checks
        require(credit > 0, 'User does not have credit to withraw');
        //2. Effects
        payouts[insuree] = 0; //reset credit to prevent multiple withrawal of the same credit
        require(payouts[insuree] == 0, 'Could not withdraw credit');
        //3. Interaction
        insuree.transfer(credit); // msg.sender        
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                            )
                            public
                            payable
                            requireIsOperational
    {
        require(allInsuredFlights[msg.sender].insuranceDetails[flight] == 0, 'This flight is already insured by this customer');
        allInsuredFlights[msg.sender].insuranceDetails[flight] = msg.value;        
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}

