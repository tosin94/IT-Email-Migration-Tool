const { transports, format, createLogger,config} = require('winston')
const {combine,timestamp,printf,colorize} = format
const path = require('path')

const myFormat = printf(({level, timestamp, label, message })=>{
    return `${timestamp}: ${level} [${label}] - ${message} `
})

const transport = {
    info: new transports.File({
        filename: path.join(__dirname, 'logs/info.log'),
        maxsize: 500000,
        maxFiles: 5,
        level: 'info'
    }),
    
    error: new transports.File({
        filename: path.join(__dirname, 'logs/error.log'),
        maxsize: 500000,
        maxFiles: 5,
        level: 'error'
    }),

    uncaught: new transports.File({
        filename: path.join(__dirname, 'logs/unhandled.log'),
        maxsize: 500000,
        maxFiles: 5,
        level: 'error'
    }),

    cons: new transports.Console({
        level: 'info',
        format: combine(colorize({all: true}))
    })
}

const T_Logger  = createLogger({
    levels: config.syslog.levels,
    format: combine(
        timestamp({format: 'ddd D MMM YYYY HH:mm:ss Z'}),
        myFormat
    ),
    transports: [transport.error, transport.cons, transport.info],
    exceptionHandlers: [transport.uncaught, new transports.Console()]

})
T_Logger.exitOnError = false


module.exports = {T_Logger}