#!/bin/sh

cd /c/IT_Email_Transfer_Tool/scripts

if [[ "$(dirname $0)" == '.' ]]; then
    dir='.'

else
    dir=$(dirname $0)
fi

flag=$(npm run scheduler | tail -n 1)
cd $dir/../
pid=$PPID

if [[ "$flag" == "cont_exec" ]]; then
    npm run cont;
    #kill -9 $pid;
    exit;

elif [[ "$flag" == "npm_start" ]]; then
    npm start;
    #kill -9 $pid;
    exit;

fi