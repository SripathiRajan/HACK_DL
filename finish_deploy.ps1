# Run this to upload the fixed script and restart the setup!
Write-Host "Uploading fixed setup script..." -ForegroundColor Cyan
scp -i "C:\Users\daksh\Downloads\aws-key.pem" -o StrictHostKeyChecking=no "scripts/setup-aws.sh" ubuntu@13.61.7.137:~/drivelegal/scripts/

Write-Host "Running setup on AWS..." -ForegroundColor Cyan
ssh -i "C:\Users\daksh\Downloads\aws-key.pem" -o StrictHostKeyChecking=no ubuntu@13.61.7.137 "cd ~/drivelegal && chmod +x scripts/setup-aws.sh && sudo ./scripts/setup-aws.sh"

Write-Host "Done! The API should now be live at http://13.61.7.137:8000" -ForegroundColor Green
