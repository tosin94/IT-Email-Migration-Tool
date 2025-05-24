const {getRunInfo, updateOpStatus, getMeta,moveToCancelled, getAllLabels,deleteAllLabels } = require('../src/database/db');
const {STATUS_KEY} = require ('../src/variables');
const TIMER = 10;
const {T_Logger: Logger } = require('../src/logging/init')
const {DB} = require('../src/calls');
const { appAscriptCloud, updateSpreadSheet } = require('../src/spreadsheet');

/**
 * Function to determine what to do when the script stops and needs to resume automatically.
 */
async function getTiming()
{
    //get the status and lastrun value
    let {res, mongo} = await getRunInfo(DB);
    let obj = {}, flag = 'abort'; 
    var check = '';
    for await (const result of res)
    {
        Object.assign(obj, result);
        check = result;
    }

    /*
    In case the operation_status collection is empty
    an empty result means start again
    */
    if (!check)
    {
        Logger.info('Operation status is empty, npm start will be called',{label: 'start.js <--automate.sh'})
        flag = "npm_start"
        console.log(flag)
        await mongo.close();
        process.exit(0);
    }
    
    //console.log(obj);
    obj.caller = obj.stage;
    obj.userId = obj.origin;

    if (await getTransferCancelStatus(obj.meta))
        await stopTransfer(obj.userId, obj.PID)
    
    delete obj.origin;
    let time = compareTime(obj.lastRun);
    

    Logger.info(`op status --> ${JSON.stringify(obj)}`,{label: 'Before check to determine next action -- start.js'})
    //if status running but nothing has happened for 10 mins
    if (obj.status == STATUS_KEY.running && time)
    {
        //reset the program and cont exec - update opstatus
        //set status to stopped then run cont exec
        obj.status = STATUS_KEY.stopped;
        await updateOpStatus(DB, obj);
        Logger.info('cont_exec will be executed --> 1', {label: 'start.js'})
        flag ="cont_exec";

    }

    //if status stopped and nothing has happened in 10mins
    else if( obj.status == STATUS_KEY.stopped && time )
    {
        //application has probable hanged or error - just call cont exec, 
        Logger.info('cont_exec will be executed --> 2',{label: 'start.js'})
        flag ="cont_exec";
    }

    else if ( obj.status == STATUS_KEY.done || obj.status == STATUS_KEY.done_err || obj.status == STATUS_KEY.aborted && time )
    {
        //npm start
        Logger.info('npm start will be executed', {label: 'start.js'})
        flag ="npm_start";
    }

    console.log(flag);
    await mongo.close();
    process.exit(0);

}

/**
 * Get time in mins and send true/false back
 * @param {String} start 
 * @returns {Boolean}  true/false
 */
function compareTime(start_date)
{
    let now = new Date();
    let old = new Date(start_date);
    let elapsed = now.getTime() - old.getTime();
    let overall = Math.floor((elapsed/1000)/60); //convert to mins

    if (overall >= TIMER)
    {
        return true
    }
    else{
        return false;
    }
}
async function stopTransfer(userId,PID) 
{
    /**
     * depending on stage of the transfer //TODO - atm it just cancels the transfer regardless
     * stop the transfer using the process ID
     *  future work - resuming the same transfer (writing functions to do that)
     */
    // let status = await getTransferCancelStatus() //not for function
    

    try 
    {
        let labelCursor = await getAllLabels(DB, userId) // or db.getLabelCollection(DB)
        var label_data = await labelCursor.toArray()
        // process.kill(PID)
        await updateOpStatus(DB,{
            reason: "Stop signal received for transfer",
            origin: userId,
            label_info: label_data[0],
            caller: STATUS_KEY.aborted
            })

    } catch (error) {
        Logger.error(`Error Stopping transfer ${error}`, {label: "StopTransfer function"})
        // TODO report to IT
        process.exit(1)
    }

    try 
    {
        Logger.info(`clearing the label data collection`, {label: "stopTransfer"})

        await deleteAllLabels(DB);
        var meta = await getMeta(DB, userId);
        await moveToCancelled(DB, userId)
        
        await updateSpreadSheet({
            function: "updateSheet",
            devMode: true,
            parameters: [
                {
                    status: STATUS_KEY.aborted,
                    row: meta.row,
                    column: meta.column,
                    date: Date().toString(),
                    finishDate: meta.finishDate,
                    flag: "finish"
                }
            ],
       });
       process.exit(0)
    }catch(error){
        console.error(error)
        process.exit(1)
        // TODO report to IT
    }    
}

/**
 * rertieve the current transfer-cancel status from the spreadsheet
 * @param {string} transfer status from the spreadsheet 
 */
async function getTransferCancelStatus(meta) {
    /**
     * get status from spreadhsheet - in start.js (call this function from start.js)
     * 
     */
    var data = {
        function: "getCancelStatus",
        devMode: true,
        parameters:[
            {
                row: meta.row,
            }
        ]
    };

    return await appAscriptCloud(data); 
}
module.exports = { getTiming}