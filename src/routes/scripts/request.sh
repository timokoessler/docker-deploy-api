#!/bin/bash

url="{{URL}}/v1/deploy"
deployToken="$1"

if [ -z "$deployToken" ]; then
  echo -e "\e[31mNo deploy token provided as first argument\e[0m"
  exit 1
fi

echo "Sending request to Docker Deploy API. The deployment can take some time."

response=$(curl -X POST -m 300 -H "X-Deploy-Token: $deployToken" -sSLw '\n%{http_code}' "$url")

# Extract the response body and status code
body=$(echo "$response" | head -n -1)
status_code=$(echo "$response" | tail -n 1)

if [ "$status_code" -ne 200 ]; then
  echo -e "\e[31mRequest failed with status code $status_code\e[0m"
  echo -e "\e[31m$body\e[0m"
  exit 1
fi

echo -e "\e[32mDeployment successful\e[0m"
echo "$body"

exit 0