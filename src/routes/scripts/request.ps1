param (
    [string]$deployToken = $args[0]
)

$url = "{{URL}}/v1/deploy"

if (-not $deployToken) {
    Write-Host -ForegroundColor Red "No deploy token provided as the first argument"
    exit 1
}

Write-Host "Sending request to Docker Deploy API. The deployment can take some time..."

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
        "X-Deploy-Token" = $deployToken
    } -TimeoutSec {{TIMEOUT}}
} catch {
    Write-Host -ForegroundColor Red "Request failed with status code $($_.Exception.Response.StatusCode.value__)"
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        if($_.Exception.Response) {
            $response = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($response)
            $reader.BaseStream.Position = 0
            $reader.DiscardBufferedData()
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            Write-Host -ForegroundColor Red $responseBody
        }
    } else {
        Write-Host -ForegroundColor Red $_.ErrorDetails.Message
    }
    exit 1
}

Write-Host -ForegroundColor Green "Deployment successful"
Write-Host $response

exit 0
