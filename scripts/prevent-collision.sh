#!/bin/bash

printf "\nWaiting for a default of 60 minutes to ensure pipeline runs don't collide"
timeElapsedSeconds=0
while [ $timeElapsedSeconds != 3600 ]; do
    sleep 1
    timeElapsedSeconds=$(($timeElapsedSeconds + 1))
    duration=$timeElapsedSeconds
    printf "\n$(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."
done

