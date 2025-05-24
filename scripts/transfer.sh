#!/bin/bash

cd /c/IT_Email_Transfer_Tool/
echo "Node process is to be stoppped for \$sam.omotayo if the running user account has changed, please enter the appropriate 
user"

read -p "Enter user account (press enter to use default): " user

if [ -z "$user" ];then
    user="\$sam.omotayo"
    echo $user
fi

exit 

echo "Stopping all node processes"
sleep 1s
#killall -v node (this will kill all node processes irrespective of user)
pkill -9 -u $user node #(will only kill node processes for specified user)
printf "Node processes successfully stopped\n\n"

printf "Enter 1 - to just stop the transfer. \nEnter 2 - to restart the current transfer.";
printf "To stop current transfer and continue to next, select option 1\n\n";

read -p "Enter option: " option


#if condition to check the option
#regardless of choice, kill all node operations

if [[ $option == 1 ]];then
    echo "option 1"
    #npm run option1

elif [[ $option == 2 ]];then
    echo "option 2"
    #npm run option2

else 
    echo "Wrong input, please run the program again"
    exit 1
fi