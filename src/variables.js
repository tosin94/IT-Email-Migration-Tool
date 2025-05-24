const OPCODES = {
    listMessage: "listMsg",
    getMessage: "getMsg",
    listLabel: "listLabel",
    createLabel: "createLabel",
    import: "importMsg"
}

const STATUS_KEY = {
    pending: "Queued to start",
    started: "Transfer in progress",
    done: "Finished",
    aborted: "Transfer Aborted",
    done_err: "Transfer finished with errors, check log",
    stopped: "stopped",
    running: "running",
    attach_err: "Transfer finished with attachment errors",
    both_err: "Transfer finished with atatchment and message errors",
    msg_err: "Transfer finished with message errors",
}

const consoleColors = {
    Reset : "\x1b[0m",
    Bright : "\x1b[1m",
    Dim : "\x1b[2m",
    Underscore : "\x1b[4m",
    Blink : "\x1b[5m",
    Reverse : "\x1b[7m",
    Hidden : "\x1b[8m",

    FgBlack : "\x1b[30m",
    FgRed : "\x1b[31m",
    FgGreen : "\x1b[32m",
    FgYellow : "\x1b[33m",
    FgBlue : "\x1b[34m",
    FgMagenta : "\x1b[35m",
    FgCyan : "\x1b[36m",
    FgWhite : "\x1b[37m",

    BgBlack : "\x1b[40m",
    BgRed : "\x1b[41m",
    BgGreen : "\x1b[42m",
    BgYellow : "\x1b[43m",
    BgBlue : "\x1b[44m",
    BgMagenta : "\x1b[45m",
    BgCyan : "\x1b[46m",
    BgWhite : "\x1b[47m"
};

const FUNCTIONS = {
    listLabel: "listLabel",
    listandsave: "listandSaveMsg",
    listandsaveLabel: "listandSaveMsgLabel",
    createLabels: "createLabels",
    putLabel: "putLabel",
    getMessage: "getMsg",
    controller: "controller",
    populateDB: "populateDB",
    createSave: "createAndSaveLabel",
    consolidate: "consolidating",
};
const DATABASE = {
    transfer: {
        collection:{
            errors: 'error_log',
            transfer_status: 'operation_status',
            transferLog: 'transfer_log',
            labels: 'label_data',
            messages: 'message_info',
            finished: 'finished_transfers',
            cancelled: 'cancelled_transfers'
        }
    }
}
module.exports = { OPCODES, STATUS_KEY, consoleColors, FUNCTIONS, DATABASE};